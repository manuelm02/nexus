package com.nexus.service;

import com.nexus.dto.response.FileTreeNodeResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * NotesService 封装 Obsidian vault 的文件系统操作，vault 路径从 SystemConfigService 动态读取。
 * 所有路径操作前强制调用 resolveSafePath 校验，防止路径穿越攻击（../ 逃逸 vault 根）。
 * 文件树只返回 .md 文件和目录，最大递归深度 10 层，避免超大 vault 性能问题。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotesService {

    private static final int MAX_DEPTH = 10;
    private static final String MD_EXT = ".md";

    private final SystemConfigService systemConfigService;

    /**
     * 递归读取 vault 目录树，只包含目录和 .md 文件。
     * 目录优先排序在前，同类型按名称字典序，保证前端文件树稳定展示。
     *
     * @return 根级节点列表
     */
    public List<FileTreeNodeResponse> getFileTree() {
        Path vaultRoot = getVaultRootPath();
        List<FileTreeNodeResponse> tree = new ArrayList<>();
        try (Stream<Path> stream = Files.list(vaultRoot)) {
            List<Path> sorted = stream.sorted(Comparator
                    .comparing((Path p) -> !Files.isDirectory(p))
                    .thenComparing(p -> p.getFileName().toString(), String.CASE_INSENSITIVE_ORDER)
            ).toList();
            for (Path child : sorted) {
                FileTreeNodeResponse node = buildNode(child, vaultRoot, 1);
                if (node != null) {
                    tree.add(node);
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("读取 vault 目录失败", e);
        }
        return tree;
    }

    /**
     * 读取 .md 文件内容为 UTF-8 字符串。
     *
     * @param relativePath 相对 vault 根的路径
     */
    public String readFile(String relativePath) {
        Path file = resolveSafePath(relativePath);
        if (!Files.isRegularFile(file)) {
            throw new IllegalArgumentException("文件不存在: " + relativePath);
        }
        try {
            return Files.readString(file);
        } catch (IOException e) {
            throw new RuntimeException("读取文件失败: " + relativePath, e);
        }
    }

    /**
     * 写入文件内容，父目录不存在时自动创建。
     *
     * @param relativePath 相对 vault 根的路径
     * @param content      文件内容
     */
    public void saveFile(String relativePath, String content) {
        Path file = resolveSafePath(relativePath);
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, content);
        } catch (IOException e) {
            throw new RuntimeException("写入文件失败: " + relativePath, e);
        }
    }

    /**
     * 创建空 .md 文件，若用户输入的路径无 .md 后缀则自动补全。
     * 父目录不存在时自动创建。
     *
     * @param relativePath 相对 vault 根的路径
     */
    public void createFile(String relativePath) {
        // 自动补全 .md 后缀，保持 vault 内文件一致性
        String normalized = relativePath.endsWith(MD_EXT) ? relativePath : relativePath + MD_EXT;
        Path file = resolveSafePath(normalized);
        if (Files.exists(file)) {
            throw new IllegalArgumentException("文件已存在: " + normalized);
        }
        try {
            Files.createDirectories(file.getParent());
            Files.createFile(file);
        } catch (IOException e) {
            throw new RuntimeException("创建文件失败: " + normalized, e);
        }
    }

    /**
     * 创建目录，已存在时抛异常。
     *
     * @param relativePath 相对 vault 根的路径
     */
    public void createFolder(String relativePath) {
        Path dir = resolveSafePath(relativePath);
        if (Files.exists(dir)) {
            throw new IllegalArgumentException("目录已存在: " + relativePath);
        }
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new RuntimeException("创建目录失败: " + relativePath, e);
        }
    }

    /**
     * 重命名/移动文件或目录，使用 Files.move 原子操作。
     * 目标路径若已存在抛异常，避免覆盖。
     *
     * @param oldPath 旧路径
     * @param newPath 新路径
     */
    public void rename(String oldPath, String newPath) {
        Path source = resolveSafePath(oldPath);
        Path target = resolveSafePath(newPath);
        if (Files.exists(target)) {
            throw new IllegalArgumentException("目标路径已存在: " + newPath);
        }
        try {
            Files.createDirectories(target.getParent());
            Files.move(source, target);
        } catch (IOException e) {
            throw new RuntimeException("重命名失败: " + oldPath + " -> " + newPath, e);
        }
    }

    /** 删除单个文件 */
    public void deleteFile(String relativePath) {
        Path file = resolveSafePath(relativePath);
        if (!Files.isRegularFile(file)) {
            throw new IllegalArgumentException("文件不存在: " + relativePath);
        }
        try {
            Files.delete(file);
        } catch (IOException e) {
            throw new RuntimeException("删除文件失败: " + relativePath, e);
        }
    }

    /**
     * 递归删除目录及其所有子内容。
     * 使用 Files.walkFileTree 自下而上删除，避免 FileUtils 额外依赖。
     *
     * @param relativePath 相对 vault 根的目录路径
     */
    public void deleteFolder(String relativePath) {
        Path dir = resolveSafePath(relativePath);
        if (!Files.isDirectory(dir)) {
            throw new IllegalArgumentException("目录不存在: " + relativePath);
        }
        try {
            Files.walkFileTree(dir, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path d, IOException exc) throws IOException {
                    Files.delete(d);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            throw new RuntimeException("删除目录失败: " + relativePath, e);
        }
    }

    // === 内部工具方法 ===

    /** 读取 vault 根路径配置，未配置时抛异常由 Controller 捕获返回友好提示 */
    private String getVaultPath() {
        String path = systemConfigService.get("notes.obsidian.vault_path");
        if (path == null || path.isBlank()) {
            throw new IllegalStateException("请先在 Settings → Notes 中配置 Obsidian vault 路径");
        }
        return path;
    }

    /** 获取 vault 根 Path，并验证路径存在且可读 */
    private Path getVaultRootPath() {
        Path root = Path.of(getVaultPath()).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            throw new IllegalStateException("vault 路径不存在或不是目录: " + root);
        }
        return root;
    }

    /**
     * 路径安全校验：将相对路径解析为 vault 内的绝对路径，normalize 后验证仍以 vault 根为前缀。
     * 防止 ../ 逃逸攻击，非法路径抛 IllegalArgumentException。
     *
     * @param relativePath 相对 vault 根的路径
     * @return 解析后的绝对路径
     */
    private Path resolveSafePath(String relativePath) {
        Path vaultRoot = Path.of(getVaultPath()).toAbsolutePath().normalize();
        Path resolved = vaultRoot.resolve(relativePath).normalize();
        if (!resolved.startsWith(vaultRoot)) {
            throw new IllegalArgumentException("非法路径: " + relativePath);
        }
        return resolved;
    }

    /**
     * 递归构建文件树节点，超过 MAX_DEPTH 或遇到非 .md 文件时跳过。
     * 隐藏文件（以 . 开头）跳过，避免展示 .obsidian 等配置目录。
     */
    private FileTreeNodeResponse buildNode(Path path, Path vaultRoot, int depth) {
        String name = path.getFileName().toString();
        // 跳过隐藏文件和目录（如 .obsidian 配置目录）
        if (name.startsWith(".")) {
            return null;
        }

        FileTreeNodeResponse node = new FileTreeNodeResponse();
        node.setName(name);
        node.setPath(vaultRoot.relativize(path).toString().replace('\\', '/'));

        if (Files.isDirectory(path)) {
            node.setType("folder");
            // 超过最大深度不再递归，避免性能问题
            if (depth >= MAX_DEPTH) {
                return node;
            }
            List<FileTreeNodeResponse> children = new ArrayList<>();
            try (Stream<Path> stream = Files.list(path)) {
                List<Path> sorted = stream.sorted(Comparator
                        .comparing((Path p) -> !Files.isDirectory(p))
                        .thenComparing(p -> p.getFileName().toString(), String.CASE_INSENSITIVE_ORDER)
                ).toList();
                for (Path child : sorted) {
                    FileTreeNodeResponse childNode = buildNode(child, vaultRoot, depth + 1);
                    if (childNode != null) {
                        children.add(childNode);
                    }
                }
            } catch (IOException e) {
                log.warn("读取目录失败（跳过）: {}", path, e);
            }
            node.setChildren(children);
        } else if (Files.isRegularFile(path) && name.endsWith(MD_EXT)) {
            node.setType("file");
        } else {
            // 非 .md 文件不展示
            return null;
        }
        return node;
    }
}
