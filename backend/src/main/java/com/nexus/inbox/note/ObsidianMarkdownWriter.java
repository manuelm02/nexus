package com.nexus.inbox.note;

import com.nexus.config.InboxIntegrationProperties;
import com.nexus.dto.request.QuickNoteRequest;
import com.nexus.dto.response.NoteTagEntryResponse;
import com.nexus.dto.response.NoteTagSuggestionResponse;
import com.nexus.dto.response.QuickNoteResponse;
import com.nexus.service.InboxSettingsService;
import com.nexus.service.NoteAiService;
import com.nexus.service.NoteTagIndexService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Obsidian Markdown 笔记写入器。
 * 将 Quick Note / Memo 内容写入 Obsidian Vault 中的 Markdown 文件（含 YAML front matter），
 * 不落 PostgreSQL 业务表。未配置 vault 路径时抛出异常，由上层返回空状态。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ObsidianMarkdownWriter implements NoteSinkPort {

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    /** 标题为空时的默认文件基础名（与 slugify 的兜底值 "note" 区分，避免英文兜底名混入中文笔记目录） */
    private static final String UNTITLED_BASE_NAME = "未命名笔记";

    private final InboxIntegrationProperties properties;
    private final InboxSettingsService inboxSettingsService;
    private final NoteTagIndexService noteTagIndexService;
    private final NoteAiService noteAiService;

    @Override
    public QuickNoteResponse write(QuickNoteRequest req) {
        if (req.getContent() == null || req.getContent().isBlank()) {
            throw new IllegalArgumentException("笔记内容不能为空");
        }

        String vaultPath = configuredValue(
                inboxSettingsService.get("inbox.obsidian.vault_path"),
                properties.getObsidian().getVaultPath());
        if (vaultPath == null || vaultPath.isBlank()) {
            throw new IllegalStateException("Obsidian 未配置，请先在设置中配置 Vault 路径");
        }
        String noteDir = resolveNoteDir(req);

        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());

        // 标签确定：用户已选标签取第一个；未选则调用 AI 建议唯一标签（可能返回新标签说明，需写回索引）
        Map<String, String> newTagDescriptions = req.getNewTagDescriptions() != null
                ? new LinkedHashMap<>(req.getNewTagDescriptions()) : new LinkedHashMap<>();
        String tag;
        if (req.getTags() != null && !req.getTags().isEmpty()) {
            tag = req.getTags().get(0);
        } else {
            NoteTagSuggestionResponse suggestion = noteAiService.suggestSingleTag(req.getContent(), req.getKind());
            tag = suggestion.getName();
            if (suggestion.getDescription() != null) {
                newTagDescriptions.put(tag, suggestion.getDescription());
            }
        }

        // 文件名基础部分：标题为空/空白时用"未命名笔记"，避免落到 slugify 的英文兜底值 "note"
        String baseName = (req.getTitle() != null && !req.getTitle().isBlank())
                ? slugify(req.getTitle())
                : "";
        if (baseName.isEmpty()) {
            baseName = UNTITLED_BASE_NAME;
        }

        // 解析并验证路径，防路径穿越
        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path targetDir = vaultRoot.resolve(noteDir).resolve(slugify(tag)).normalize().toAbsolutePath();

        // 验证 targetDir 在 vaultRoot 之下，防止 ../ 路径穿越
        if (!targetDir.startsWith(vaultRoot)) {
            throw new SecurityException("笔记路径不在 Obsidian Vault 范围内");
        }

        try {
            Files.createDirectories(targetDir);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建笔记目录: " + targetDir, e);
        }

        // 文件名冲突时依次追加序号，避免覆盖已有同名笔记
        String fileName = resolveFileName(targetDir, baseName);

        Path filePath = targetDir.resolve(fileName).normalize().toAbsolutePath();
        // 再次检查最终文件路径也在 vaultRoot 内
        if (!filePath.startsWith(vaultRoot)) {
            throw new SecurityException("文件路径穿越检测失败");
        }

        // 不将 token/密钥信息写入日志，仅记录文件名
        String markdown = buildMarkdown(req, now, tag);
        try {
            Files.writeString(filePath, markdown, StandardCharsets.UTF_8);
            log.debug("笔记已写入 Obsidian Vault: {}", fileName);
        } catch (IOException e) {
            throw new IllegalStateException("无法写入笔记文件: " + filePath, e);
        }

        // 标签索引漂移防护：用户手动选择了一个既不在索引中、也未随请求附带说明的标签
        // （例如直接复用了已写入文件但尚未登记到索引的标签）时，补一条占位说明一并写回索引，
        // 避免 Vault 目录中出现索引文件里查不到的标签
        if (!newTagDescriptions.containsKey(tag)) {
            Set<String> indexedNames = noteTagIndexService.listTags(req.getKind()).stream()
                    .map(NoteTagEntryResponse::getName)
                    .collect(Collectors.toSet());
            if (!indexedNames.contains(tag)) {
                newTagDescriptions.put(tag, "（待补充说明）");
            }
        }

        // 保存成功后同步标签索引：合并用户提供的新标签说明、AI 自动打标签产生的新标签说明，
        // 以及上面补充的占位说明
        noteTagIndexService.syncNewTags(req.getKind(), newTagDescriptions);

        QuickNoteResponse resp = new QuickNoteResponse();
        resp.setPath(filePath.toString());
        // 返回相对 vault 路径给前端展示，不暴露绝对路径
        Path relativePath = vaultRoot.relativize(filePath);
        resp.setRelativePath(relativePath.toString());
        resp.setCreatedAt(now.format(ISO_FORMATTER));
        resp.setTag(tag);
        return resp;
    }

    /**
     * 解析最终文件名：若 {baseName}.md 已存在，依次尝试 {baseName}-2.md、-3.md... 直到不冲突。
     */
    private String resolveFileName(Path targetDir, String baseName) {
        String fileName = baseName + ".md";
        int seq = 2;
        while (Files.exists(targetDir.resolve(fileName))) {
            fileName = baseName + "-" + seq + ".md";
            seq++;
        }
        return fileName;
    }

    /**
     * 根据笔记类型选择目标目录。用户只配置 Inbox 根目录，子目录由系统固定派生，避免目录迁移歧义。
     */
    private String resolveNoteDir(QuickNoteRequest req) {
        String kind = req.getKind() != null ? req.getKind() : "quick_note";
        if ("memo".equals(kind)) {
            return inboxSettingsService.getObsidianMemoDir();
        }
        return inboxSettingsService.getObsidianQuickNoteDir();
    }

    private String configuredValue(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    /**
     * 构建含 YAML front matter 的 Markdown 内容。tags 列表只写入最终确定的唯一标签，
     * 与"恰好 1 个标签"的存储约定保持一致。
     */
    private String buildMarkdown(QuickNoteRequest req, ZonedDateTime now, String tag) {
        StringBuilder sb = new StringBuilder();
        sb.append("---\n");
        sb.append("source: nexus\n");
        sb.append("type: ").append(req.getKind() != null ? req.getKind() : "quick_note").append("\n");
        sb.append("created: ").append(now.format(ISO_FORMATTER)).append("\n");
        if (tag != null && !tag.isBlank()) {
            sb.append("tags:\n");
            sb.append("  - ").append(tag.trim()).append("\n");
        }
        sb.append("---\n\n");
        if (req.getTitle() != null && !req.getTitle().isBlank()) {
            sb.append("# ").append(req.getTitle().trim()).append("\n\n");
        }
        sb.append(req.getContent());
        sb.append("\n");
        return sb.toString();
    }

    /**
     * 将标题转为文件名的 slug：中文保留原样，英文小写，空格/特殊字符替换为连字符。
     * 第一版简单实现，不做拼音转换。
     */
    private String slugify(String input) {
        if (input == null || input.isBlank()) return "note";
        return input.trim()
                .replaceAll("[\\\\/:*?\"<>|\\s]+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }
}
