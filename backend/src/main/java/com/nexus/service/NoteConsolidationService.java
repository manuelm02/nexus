package com.nexus.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.NoteConsolidatePreviewRequest;
import com.nexus.dto.request.NoteConsolidateWriteRequest;
import com.nexus.dto.response.NoteConsolidatePreviewResponse;
import com.nexus.dto.response.QuickNoteResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 笔记合并服务，将多条 Inbox 笔记合并为整理后的永久笔记写入 Obsidian Vault。
 * 支持按天 (daily)、按主题 (topic) 和手动 (manual) 三种合并模式。
 * 合并过程由 LLM 驱动，LLM 不可用时降级为简单拼接。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteConsolidationService {

    private final LlmConfigService llmConfigService;
    private final InboxSettingsService inboxSettingsService;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final DateTimeFormatter FILE_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 从 LLM 响应中提取 JSON 的正则 */
    private static final Pattern JSON_BLOCK_PATTERN = Pattern.compile(
            "```(?:json)?\\s*\\n?([\\s\\S]*?)```");

    /**
     * 预览笔记合并结果，读取源文件后调用 LLM 生成合并后的 Markdown。
     * 不写入任何文件，仅返回建议标题、内容和输出路径。
     *
     * @param req 包含源文件路径列表、合并模式和可选主题
     * @return 合并预览结果
     */
    public NoteConsolidatePreviewResponse preview(NoteConsolidatePreviewRequest req) {
        NoteConsolidatePreviewResponse resp = new NoteConsolidatePreviewResponse();
        resp.setSourcePaths(req.getSourcePaths());

        // 1. 读取源文件内容
        List<SourceNote> sources = readSourceNotes(req.getSourcePaths());

        // 2. LLM 不可用时降级为简单拼接
        if (!inboxSettingsService.isInboxAiAvailable()) {
            String fallback = buildFallbackMarkdown(sources, req.getMode(), req.getTopic());
            resp.setTitle(req.getTopic() != null ? req.getTopic() : "合并笔记");
            resp.setMarkdown(fallback);
            resp.setSuggestedPath(generateSuggestedPath(req));
            return resp;
        }

        // 3. 调用 LLM 合并
        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            String prompt = buildConsolidatePrompt(sources, req.getMode(), req.getTopic());
            String response = model.generate(prompt);

            String jsonStr = extractJson(response);
            // LLM 直接返回 markdown 文本则作为纯合并内容处理
            if ("{}".equals(jsonStr)) {
                resp.setTitle(req.getTopic() != null ? req.getTopic() : "合并笔记");
                resp.setMarkdown(response);
            } else {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = objectMapper.readValue(jsonStr, Map.class);
                resp.setTitle(getString(result, "title", req.getTopic() != null ? req.getTopic() : "合并笔记"));
                resp.setMarkdown(getString(result, "markdown", ""));
            }
            resp.setSuggestedPath(generateSuggestedPath(req));

        } catch (Exception e) {
            log.warn("笔记合并 LLM 调用失败，降级为简单拼接: {}", e.getMessage());
            String fallback = buildFallbackMarkdown(sources, req.getMode(), req.getTopic());
            resp.setTitle(req.getTopic() != null ? req.getTopic() : "合并笔记");
            resp.setMarkdown(fallback);
            resp.setSuggestedPath(generateSuggestedPath(req));
        }

        return resp;
    }

    /**
     * 执行笔记合并写入，将合并内容持久化到 Obsidian Vault 的 consolidation 目录。
     * 在 front matter 中列出所有源文件路径以便追溯。
     *
     * @param req 包含标题、Markdown 内容、源文件列表和可选输出路径
     * @return 写入成功后的文件信息
     */
    public QuickNoteResponse write(NoteConsolidateWriteRequest req) {
        // 1. 校验 Obsidian 配置
        if (!inboxSettingsService.isObsidianConfigured()) {
            throw new IllegalStateException("Obsidian 未配置，请先在设置中配置 Vault 路径");
        }

        String vaultPath = inboxSettingsService.get("inbox.obsidian.vault_path");
        String consolidationDir = inboxSettingsService.getObsidianConsolidationDir();

        // 2. 构建输出路径
        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path targetDir = vaultRoot.resolve(consolidationDir).normalize().toAbsolutePath();

        // 路径穿越校验
        if (!targetDir.startsWith(vaultRoot)) {
            throw new SecurityException("合并输出路径不在 Obsidian Vault 范围内");
        }

        try {
            Files.createDirectories(targetDir);
        } catch (IOException e) {
            throw new IllegalStateException("无法创建合并输出目录: " + targetDir, e);
        }

        // 3. 生成文件名
        String slug = slugify(req.getTitle());
        String fileName = FILE_DATE.format(ZonedDateTime.now(ZoneId.systemDefault()))
                + "-consolidated-" + slug + ".md";

        Path filePath = targetDir.resolve(fileName).normalize().toAbsolutePath();
        if (!filePath.startsWith(vaultRoot)) {
            throw new SecurityException("文件路径穿越检测失败");
        }

        // 4. 构建含 front matter 的 Markdown 内容
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        String markdown = buildConsolidatedMarkdown(req.getTitle(), req.getMarkdown(),
                req.getSourcePaths(), now);

        try {
            Files.writeString(filePath, markdown, StandardCharsets.UTF_8);
            log.debug("合并笔记已写入: {}", fileName);
        } catch (IOException e) {
            throw new IllegalStateException("无法写入合并笔记: " + filePath, e);
        }

        Path relativePath = vaultRoot.relativize(filePath);

        QuickNoteResponse resp = new QuickNoteResponse();
        resp.setPath(filePath.toString());
        resp.setRelativePath(relativePath.toString());
        resp.setCreatedAt(now.format(ISO_FORMATTER));
        return resp;
    }

    /**
     * 读取源文件内容，同时校验路径安全性。
     * 若文件不在 vault/inbox 范围内或不存在，静默跳过并记录日志。
     */
    private List<SourceNote> readSourceNotes(List<String> sourcePaths) {
        String vaultPath = inboxSettingsService.get("inbox.obsidian.vault_path");
        String quickNoteDir = inboxSettingsService.getObsidianQuickNoteDir();
        String memoDir = inboxSettingsService.getObsidianMemoDir();

        if (vaultPath == null || vaultPath.isBlank()) {
            throw new IllegalStateException("Obsidian Vault 路径未配置");
        }

        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path inboxRoot = vaultRoot.resolve(quickNoteDir).normalize().toAbsolutePath();
        Path memoRoot = vaultRoot.resolve(memoDir).normalize().toAbsolutePath();

        List<SourceNote> sources = new ArrayList<>();
        for (String sourcePath : sourcePaths) {
            try {
                if (sourcePath == null || sourcePath.isBlank()) continue;
                Path filePath = vaultRoot.resolve(sourcePath).normalize().toAbsolutePath();
                // 路径穿越校验：必须在 vault 范围内且来自 Quick Note 或 Memo 目录。
                if (!filePath.startsWith(inboxRoot) && !filePath.startsWith(memoRoot)) {
                    log.warn("源文件路径不在 Quick Note / Memo 范围内，已跳过: {}", sourcePath);
                    continue;
                }
                if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
                    log.warn("源文件不存在或不是常规文件，已跳过: {}", sourcePath);
                    continue;
                }
                String content = Files.readString(filePath, StandardCharsets.UTF_8);
                // 提取 YAML front matter 后的正文内容
                String body = stripFrontMatter(content);
                sources.add(new SourceNote(sourcePath, body,
                        extractTitleFromContent(content)));
            } catch (IOException e) {
                log.warn("读取源文件失败: {} - {}", sourcePath, e.getMessage());
            }
        }
        return sources;
    }

    /**
     * 构建 LLM 合并 Prompt。
     */
    private String buildConsolidatePrompt(List<SourceNote> sources, String mode, String topic) {
        String modeLabel = switch (mode != null ? mode : "manual") {
            case "daily" -> "按天合并";
            case "topic" -> "按主题合并";
            default -> "手动合并";
        };
        String topicHint = topic != null && !topic.isBlank()
                ? "合并主题：" + topic : "";

        StringBuilder notesSection = new StringBuilder();
        int idx = 1;
        for (SourceNote sn : sources) {
            notesSection.append("--- 笔记 ").append(idx).append(" ---\n");
            if (sn.title != null) {
                notesSection.append("原标题: ").append(sn.title).append("\n");
            }
            notesSection.append(sn.content).append("\n\n");
            idx++;
        }

        return """
                你是一个个人知识管理助手。请将以下 %d 条笔记 %s %s 合并为一条完整的永久笔记。
                保留所有关键信息，去重，按逻辑组织段落，补充必要的上下文。
                返回严格的 JSON 格式（不要包含 markdown 代码块标记）。

                %s

                请返回 JSON：
                {
                  "title": "合并后的标题",
                  "markdown": "合并后的 Markdown（包含标题）"
                }

                要求：
                - 标题精确概括内容核心，不超过 50 字
                - 合并模式：%s
                - 按 总览 → 详情 → 行动项 逻辑组织
                - 保留每条笔记中的链接和引用
                """
                .formatted(sources.size(), modeLabel, topicHint,
                        notesSection.toString(), modeLabel);
    }

    /**
     * LLM 不可用时的降级合并：简单拼接并添加分隔线。
     */
    private String buildFallbackMarkdown(List<SourceNote> sources, String mode, String topic) {
        StringBuilder sb = new StringBuilder();
        String title = topic != null && !topic.isBlank() ? topic : "合并笔记";
        sb.append("# ").append(title).append("\n\n");
        sb.append("> 合并模式: ")
                .append(mode != null ? mode : "manual")
                .append(" | 合并时间: ")
                .append(ZonedDateTime.now(ZoneId.systemDefault()).format(ISO_FORMATTER))
                .append("\n\n");

        for (int i = 0; i < sources.size(); i++) {
            if (i > 0) sb.append("\n---\n\n");
            SourceNote sn = sources.get(i);
            if (sn.title != null) {
                sb.append("### ").append(sn.title).append("\n\n");
            }
            sb.append(sn.content).append("\n");
        }
        return sb.toString();
    }

    /**
     * 构建含 YAML front matter 的合并后 Markdown 内容。
     * front matter 中记录 source 为 nexus、type 为 consolidated，并列明所有源文件路径。
     */
    private String buildConsolidatedMarkdown(String title, String markdownBody,
                                              List<String> sourcePaths, ZonedDateTime now) {
        StringBuilder sb = new StringBuilder();
        sb.append("---\n");
        sb.append("source: nexus\n");
        sb.append("type: consolidated\n");
        sb.append("created: ").append(now.format(ISO_FORMATTER)).append("\n");
        sb.append("sources:\n");
        for (String sp : sourcePaths) {
            sb.append("  - ").append(sp).append("\n");
        }
        sb.append("---\n\n");
        // 若 markdownBody 已含标题则不重复添加
        if (!markdownBody.trim().startsWith("# ")) {
            sb.append("# ").append(title).append("\n\n");
        }
        sb.append(markdownBody.trim());
        sb.append("\n");
        return sb.toString();
    }

    /**
     * 去除 YAML front matter，返回正文内容。
     * 支持 --- 开头和末尾 --- 的 front matter 格式。
     */
    private String stripFrontMatter(String content) {
        if (content == null || !content.trim().startsWith("---")) {
            return content != null ? content : "";
        }
        int end = content.indexOf("---", 3);
        if (end < 0) return content;
        return content.substring(end + 3).trim();
    }

    /**
     * 从 Markdown 内容中提取标题（首个 # heading），fallback 返回 null。
     */
    private String extractTitleFromContent(String content) {
        if (content == null) return null;
        for (String line : content.split("\\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("# ")) {
                return trimmed.substring(2).trim();
            }
        }
        return null;
    }

    /** 生成建议的输出文件路径 */
    private String generateSuggestedPath(NoteConsolidatePreviewRequest req) {
        String consolidationDir = inboxSettingsService.getObsidianConsolidationDir();
        String date = FILE_DATE.format(ZonedDateTime.now(ZoneId.systemDefault()));
        String nameHint;
        if ("daily".equals(req.getMode())) {
            nameHint = "daily-" + date;
        } else if (req.getTopic() != null && !req.getTopic().isBlank()) {
            nameHint = slugify(req.getTopic());
        } else {
            nameHint = "consolidated-" + date;
        }
        return consolidationDir + "/" + date + "-" + nameHint + ".md";
    }

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        Object val = map.get(key);
        if (val == null) return defaultValue;
        String str = val.toString();
        return str.isBlank() ? defaultValue : str;
    }

    private String slugify(String input) {
        if (input == null || input.isBlank()) return "note";
        return input.trim()
                .replaceAll("[\\\\/:*?\"<>|\\s]+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    /**
     * 从 LLM 响应中提取 JSON 字符串。
     * 处理 ```json ... ``` 包裹以及直接返回 JSON 的情况。
     */
    private String extractJson(String response) {
        if (response == null || response.isBlank()) {
            return "{}";
        }
        Matcher matcher = JSON_BLOCK_PATTERN.matcher(response);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        int start = response.indexOf('{');
        int end = response.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return response.substring(start, end + 1).trim();
        }
        log.warn("无法从 LLM 响应中提取 JSON，原始响应前 200 字符: {}",
                response.substring(0, Math.min(200, response.length())));
        return "{}";
    }

    /** 源笔记内部数据结构 */
    private record SourceNote(String path, String content, String title) {}
}
