package com.nexus.adapter.note;

import com.nexus.port.NotePort;
import com.nexus.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * NotePort 的 Obsidian vault 实现。vault 根路径从 SystemConfigService 动态读取，
 * 与 NotesService（前端 Notes 页面）共享同一 vault 配置。
 *
 * 所有路径操作前都通过 resolveSafePath 校验相对路径不越界 vault 根，
 * 防止外部输入含 "../" 逃逸到 vault 之外。
 *
 * 目录结构：
 * {vault}/{subFolder}/{workspaceSafeName}__master.md
 * {vault}/{subFolder}/{workspaceSafeName}__session__{date}.md
 * {vault}/{subFolder}/_index.md
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ObsidianNoteAdapter implements NotePort {

    private static final String MD_EXT = ".md";
    private static final String INDEX_FILE = "_index.md";
    /** 递归扫描最大深度，避免超大 vault 性能问题 */
    private static final int MAX_DEPTH = 5;
    /** 索引文件默认标题 */
    private static final String INDEX_HEADER = "# Mindbank 知识索引\n\n";

    private final SystemConfigService systemConfigService;

    // === Public API ===

    @Override
    public String readMaster(String workspaceName) {
        // Master Note 可能放在 vault 任意子文件夹下，遍历查找避免遗漏
        try (Stream<Path> walk = Files.walk(getVaultRoot(), MAX_DEPTH)) {
            String safeName = safeFileName(workspaceName);
            return walk
                .filter(Files::isRegularFile)
                .filter(p -> p.getFileName().toString().equals(safeName + "__master" + MD_EXT))
                .findFirst()
                .map(p -> {
                    try {
                        return Files.readString(p);
                    } catch (IOException e) {
                        throw new RuntimeException("读取 Master Note 失败: " + p, e);
                    }
                })
                .orElse(null);
        } catch (IOException e) {
            throw new RuntimeException("扫描 vault 查找 Master Note 失败: workspace=" + workspaceName, e);
        }
    }

    @Override
    public void writeMaster(String workspaceName, String subFolder, String content) {
        String safeName = safeFileName(workspaceName);
        String relPath = sanitizeSubFolder(subFolder) + "/" + safeName + "__master" + MD_EXT;
        Path file = resolveSafePath(relPath);
        try {
            Files.createDirectories(file.getParent());
            // CREATE + TRUNCATE_EXISTING 等价于"覆盖写入"
            Files.writeString(file, content);
        } catch (IOException e) {
            throw new RuntimeException("写入 Master Note 失败: " + relPath, e);
        }
    }

    @Override
    public void appendSession(String workspaceName, String subFolder, String content, String date) {
        String safeName = safeFileName(workspaceName);
        String folder = sanitizeSubFolder(subFolder);
        // 同日重复导入时文件名追加序号，避免覆盖历史 Session Note
        String baseName = safeName + "__session__" + date;
        Path target = resolveSafePath(folder + "/" + baseName + MD_EXT);
        int suffix = 1;
        while (Files.exists(target)) {
            target = resolveSafePath(folder + "/" + baseName + "_" + suffix + MD_EXT);
            suffix++;
        }
        try {
            Files.createDirectories(target.getParent());
            Files.writeString(target, content);
        } catch (IOException e) {
            throw new RuntimeException("写入 Session Note 失败: " + target.getFileName(), e);
        }
    }

    @Override
    public List<NoteMeta> listNotes() {
        List<NoteMeta> result = new ArrayList<>();
        Path vaultRoot = getVaultRoot();
        try (Stream<Path> walk = Files.walk(vaultRoot, MAX_DEPTH)) {
            walk
                .filter(Files::isRegularFile)
                .filter(p -> p.getFileName().toString().endsWith(MD_EXT))
                .filter(p -> !isHidden(p))
                .sorted(Comparator.comparing(Path::toString))
                .forEach(p -> result.add(toMeta(p, vaultRoot)));
        } catch (IOException e) {
            throw new RuntimeException("扫描 vault 笔记失败", e);
        }
        return result;
    }

    @Override
    public String readIndex(String subFolder) {
        Path indexPath = resolveSafePath(sanitizeSubFolder(subFolder) + "/" + INDEX_FILE);
        if (!Files.exists(indexPath)) {
            return "";
        }
        try {
            return Files.readString(indexPath);
        } catch (IOException e) {
            throw new RuntimeException("读取索引文件失败: " + indexPath, e);
        }
    }

    @Override
    public void appendIndex(String subFolder, String entry) {
        Path indexPath = resolveSafePath(sanitizeSubFolder(subFolder) + "/" + INDEX_FILE);
        try {
            Files.createDirectories(indexPath.getParent());
            // 文件不存在时先写标题，保证可读性
            if (!Files.exists(indexPath)) {
                Files.writeString(indexPath, INDEX_HEADER);
            }
            Files.writeString(indexPath, entry + "\n", java.nio.file.StandardOpenOption.APPEND);
        } catch (IOException e) {
            throw new RuntimeException("追加索引文件失败: " + indexPath, e);
        }
    }

    // === 内部工具方法 ===

    /**
     * vault 路径：notes.obsidian.vault_path。未配置时抛 IllegalStateException 由 Controller 捕获返回友好提示。
     */
    private Path getVaultRoot() {
        String path = systemConfigService.get("notes.obsidian.vault_path");
        if (path == null || path.isBlank()) {
            throw new IllegalStateException("请先在 Settings → Mindbank 中配置 Obsidian vault 路径");
        }
        return Path.of(path).toAbsolutePath().normalize();
    }

    /**
     * 路径安全校验：将相对路径解析为 vault 内的绝对路径，normalize 后验证仍以 vault 根为前缀。
     * 防止 ../ 逃逸攻击，非法路径抛 IllegalArgumentException。
     */
    private Path resolveSafePath(String relativePath) {
        Path vaultRoot = getVaultRoot();
        Path resolved = vaultRoot.resolve(relativePath).normalize();
        if (!resolved.startsWith(vaultRoot)) {
            throw new IllegalArgumentException("非法路径: " + relativePath);
        }
        return resolved;
    }

    /**
     * workspace 名称转安全文件名：去除文件系统保留字符。
     * 保留 Obsidian 不允许的字符（/\\:*?"<>|），避免写入时被解释为路径分隔符或设备名。
     */
    private String safeFileName(String workspaceName) {
        return workspaceName.replaceAll("[/\\\\:*?\"<>|]", "_");
    }

    /**
     * subFolder 清理：去除首尾分隔符、规范化反斜杠为正斜杠、拒绝空字符串。
     * 不做路径穿越校验（由 resolveSafePath 兜底）。
     */
    private String sanitizeSubFolder(String subFolder) {
        if (subFolder == null || subFolder.isBlank()) {
            throw new IllegalArgumentException("subFolder 不能为空");
        }
        return subFolder.trim().replaceAll("^[/\\\\]+|[/\\\\]+$", "").replace('\\', '/');
    }

    /** 隐藏文件/目录过滤（以 . 开头） */
    private boolean isHidden(Path p) {
        for (Path part : p) {
            if (part.toString().startsWith(".")) {
                return true;
            }
        }
        return false;
    }

    /** Path → NoteMeta 转换，统一时间戳到系统时区 */
    private NoteMeta toMeta(Path p, Path vaultRoot) {
        try {
            BasicFileAttributes attrs = Files.readAttributes(p, BasicFileAttributes.class);
            LocalDateTime lastModified = attrs.lastModifiedTime()
                .toInstant()
                .atZone(ZoneId.systemDefault())
                .toLocalDateTime();
            return new NoteMeta(
                p.getFileName().toString(),
                vaultRoot.relativize(p).toString().replace('\\', '/'),
                attrs.size(),
                lastModified
            );
        } catch (IOException e) {
            // 元数据读取失败时返回默认值，避免单文件异常中断整体扫描
            log.warn("读取文件元信息失败（跳过）: {}", p, e);
            return new NoteMeta(
                p.getFileName().toString(),
                vaultRoot.relativize(p).toString().replace('\\', '/'),
                0L,
                LocalDateTime.now()
            );
        }
    }
}
