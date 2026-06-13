package com.nexus.inbox.note;

import com.nexus.config.InboxIntegrationProperties;
import com.nexus.dto.request.QuickNoteRequest;
import com.nexus.dto.response.QuickNoteResponse;
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
import java.util.List;

/**
 * Obsidian Markdown 笔记写入器。
 * 将 Quick Note / Memo 内容写入 Obsidian Vault 中的 Markdown 文件（含 YAML front matter），
 * 不落 PostgreSQL 业务表。未配置 vault 路径时抛出异常，由上层返回空状态。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ObsidianMarkdownWriter implements NoteSinkPort {

    private static final DateTimeFormatter FILE_TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmmss");
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final InboxIntegrationProperties properties;

    @Override
    public QuickNoteResponse write(QuickNoteRequest req) {
        if (!properties.getObsidian().isConfigured()) {
            throw new IllegalStateException("Obsidian 未配置，请设置 OBSIDIAN_VAULT_PATH 环境变量");
        }
        if (req.getContent() == null || req.getContent().isBlank()) {
            throw new IllegalArgumentException("笔记内容不能为空");
        }

        String vaultPath = properties.getObsidian().getVaultPath();
        String inboxDir = properties.getObsidian().getInboxDir();

        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());

        // 文件路径：vaultPath / inboxDir / yyyy / MM / yyyy-MM-dd-HHmmss-slug.md
        String slug = slugify(req.getTitle() != null && !req.getTitle().isBlank() ? req.getTitle() : "note");
        String year = String.valueOf(now.getYear());
        String month = String.format("%02d", now.getMonthValue());
        String fileName = now.format(FILE_TIMESTAMP) + "-" + slug + ".md";

        // 解析并验证路径，防路径穿越
        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path targetDir = vaultRoot.resolve(inboxDir).resolve(year).resolve(month).normalize().toAbsolutePath();

        // 验证 targetDir 在 vaultRoot 之下，防止 ../ 路径穿越
        if (!targetDir.startsWith(vaultRoot)) {
            throw new SecurityException("笔记路径不在 Obsidian Vault 范围内");
        }

        try {
            Files.createDirectories(targetDir);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建笔记目录: " + targetDir, e);
        }

        Path filePath = targetDir.resolve(fileName).normalize().toAbsolutePath();
        // 再次检查最终文件路径也在 vaultRoot 内
        if (!filePath.startsWith(vaultRoot)) {
            throw new SecurityException("文件路径穿越检测失败");
        }

        // 不将 token/密钥信息写入日志，仅记录文件名
        String markdown = buildMarkdown(req, now);
        try {
            Files.writeString(filePath, markdown, StandardCharsets.UTF_8);
            log.debug("笔记已写入 Obsidian Vault: {}", fileName);
        } catch (IOException e) {
            throw new IllegalStateException("无法写入笔记文件: " + filePath, e);
        }

        QuickNoteResponse resp = new QuickNoteResponse();
        resp.setPath(filePath.toString());
        // 返回相对 vault 路径给前端展示，不暴露绝对路径
        Path relativePath = vaultRoot.relativize(filePath);
        resp.setRelativePath(relativePath.toString());
        resp.setCreatedAt(now.format(ISO_FORMATTER));
        return resp;
    }

    /**
     * 构建含 YAML front matter 的 Markdown 内容。
     */
    private String buildMarkdown(QuickNoteRequest req, ZonedDateTime now) {
        StringBuilder sb = new StringBuilder();
        sb.append("---\n");
        sb.append("source: nexus\n");
        sb.append("type: ").append(req.getKind() != null ? req.getKind() : "quick_note").append("\n");
        sb.append("created: ").append(now.format(ISO_FORMATTER)).append("\n");
        if (req.getTags() != null && !req.getTags().isEmpty()) {
            sb.append("tags:\n");
            for (String tag : req.getTags()) {
                String t = tag.trim();
                if (!t.isEmpty()) {
                    sb.append("  - ").append(t).append("\n");
                }
            }
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
