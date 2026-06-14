package com.nexus.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.NoteSummarizeRequest;
import com.nexus.dto.response.NoteSummarizeResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 笔记汇总服务：按标题关键词和/或标签筛选 Quick Note / Memo 笔记，
 * 调用 LLM 生成汇总 Markdown（不写入文件）。LLM 不可用时降级为简单拼接。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteSummaryService {

    private final LlmConfigService llmConfigService;
    private final InboxSettingsService inboxSettingsService;
    private final ObjectMapper objectMapper;

    /** 从 LLM 响应中提取 JSON 的正则 */
    private static final Pattern JSON_BLOCK_PATTERN = Pattern.compile(
            "```(?:json)?\\s*\\n?([\\s\\S]*?)```");

    /**
     * 按筛选条件汇总笔记。
     * titleQuery 和 tags 均为空时不扫描，直接返回空结果（matchedCount=0, markdown=null）。
     *
     * @param req 筛选条件：kind 必填，titleQuery / tags 至少一个非空
     * @return 汇总结果
     */
    public NoteSummarizeResponse summarize(NoteSummarizeRequest req) {
        NoteSummarizeResponse resp = new NoteSummarizeResponse();

        boolean hasTitleQuery = req.getTitleQuery() != null && !req.getTitleQuery().isBlank();
        boolean hasTags = req.getTags() != null && !req.getTags().isEmpty();
        if (!hasTitleQuery && !hasTags) {
            resp.setMatchedCount(0);
            resp.setMarkdown(null);
            return resp;
        }

        List<SourceNote> matched = scanMatchingNotes(req, hasTitleQuery, hasTags);
        resp.setMatchedCount(matched.size());
        if (matched.isEmpty()) {
            resp.setMarkdown(null);
            return resp;
        }

        if (!inboxSettingsService.isInboxAiAvailable()) {
            resp.setMarkdown(buildFallbackMarkdown(matched));
            return resp;
        }

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            String prompt = buildSummarizePrompt(matched);
            String response = model.generate(prompt);

            String jsonStr = extractJson(response);
            if ("{}".equals(jsonStr)) {
                resp.setMarkdown(response);
            } else {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = objectMapper.readValue(jsonStr, Map.class);
                resp.setMarkdown(getString(result, "markdown", buildFallbackMarkdown(matched)));
            }
        } catch (Exception e) {
            log.warn("笔记汇总 LLM 调用失败，降级为简单拼接: {}", e.getMessage());
            resp.setMarkdown(buildFallbackMarkdown(matched));
        }

        return resp;
    }

    /**
     * 扫描对应 kind 目录下所有 .md 文件，按标题/标签筛选条件返回匹配的笔记。
     * 两个条件均提供时取交集（AND）；Vault 未配置或目录不存在时返回空列表。
     */
    private List<SourceNote> scanMatchingNotes(NoteSummarizeRequest req, boolean hasTitleQuery, boolean hasTags) {
        String vaultPath = inboxSettingsService.get("inbox.obsidian.vault_path");
        if (vaultPath == null || vaultPath.isBlank()) {
            return List.of();
        }

        String noteDir = "memo".equals(req.getKind())
                ? inboxSettingsService.getObsidianMemoDir()
                : inboxSettingsService.getObsidianQuickNoteDir();

        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path noteRoot = vaultRoot.resolve(noteDir).normalize().toAbsolutePath();
        if (!noteRoot.startsWith(vaultRoot) || !Files.isDirectory(noteRoot)) {
            return List.of();
        }

        String titleQueryLower = hasTitleQuery ? req.getTitleQuery().trim().toLowerCase() : null;

        List<SourceNote> matched = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(noteRoot)) {
            for (Path path : paths.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".md"))
                    .toList()) {
                String content;
                try {
                    content = Files.readString(path, StandardCharsets.UTF_8);
                } catch (IOException e) {
                    log.warn("读取笔记失败，已跳过: {} - {}", path, e.getMessage());
                    continue;
                }
                String title = extractTitleFromContent(content);
                List<String> tags = extractTagsFromFrontMatter(content);

                boolean titleMatches = !hasTitleQuery
                        || (title != null && title.toLowerCase().contains(titleQueryLower));
                boolean tagsMatch = !hasTags
                        || tags.stream().anyMatch(req.getTags()::contains);

                if (titleMatches && tagsMatch) {
                    matched.add(new SourceNote(title, stripFrontMatter(content)));
                }
            }
        } catch (IOException e) {
            log.warn("扫描笔记目录失败: {}", e.getMessage());
        }
        return matched;
    }

    /** 构建 LLM 汇总 Prompt */
    private String buildSummarizePrompt(List<SourceNote> notes) {
        StringBuilder notesSection = new StringBuilder();
        int idx = 1;
        for (SourceNote sn : notes) {
            notesSection.append("--- 笔记 ").append(idx).append(" ---\n");
            if (sn.title() != null) {
                notesSection.append("标题: ").append(sn.title()).append("\n");
            }
            notesSection.append(sn.content()).append("\n\n");
            idx++;
        }

        return """
                你是一个个人知识管理助手。请阅读以下 %d 条笔记，生成一份汇总 Markdown。
                返回严格的 JSON 格式（不要包含 markdown 代码块标记）。

                %s

                请返回 JSON：
                {
                  "markdown": "汇总内容（Markdown 格式，包含标题）"
                }

                要求：
                - 按主题归类，去重合并相似信息
                - 保留关键信息和重要细节
                - 使用清晰的标题和列表结构
                """
                .formatted(notes.size(), notesSection.toString());
    }

    /** LLM 不可用时的降级汇总：按匹配顺序简单拼接 */
    private String buildFallbackMarkdown(List<SourceNote> notes) {
        StringBuilder sb = new StringBuilder();
        sb.append("# 笔记汇总\n\n");
        for (int i = 0; i < notes.size(); i++) {
            if (i > 0) sb.append("\n---\n\n");
            SourceNote sn = notes.get(i);
            if (sn.title() != null) {
                sb.append("### ").append(sn.title()).append("\n\n");
            }
            sb.append(sn.content()).append("\n");
        }
        return sb.toString();
    }

    /** 去除 YAML front matter，返回正文内容。 */
    private String stripFrontMatter(String content) {
        if (content == null || !content.trim().startsWith("---")) {
            return content != null ? content : "";
        }
        int end = content.indexOf("---", 3);
        if (end < 0) return content;
        return content.substring(end + 3).trim();
    }

    /** 从 Markdown 内容中提取标题（首个 # heading），fallback 返回 null。 */
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

    /**
     * 从 YAML front matter 中提取 tags 列表（"tags:" 后的 "  - xxx" 行）。
     * front matter 不存在或无 tags 字段时返回空列表。
     */
    private List<String> extractTagsFromFrontMatter(String content) {
        if (content == null || !content.trim().startsWith("---")) {
            return List.of();
        }
        int end = content.indexOf("---", 3);
        if (end < 0) return List.of();
        String frontMatter = content.substring(0, end);

        List<String> tags = new ArrayList<>();
        boolean inTags = false;
        for (String line : frontMatter.split("\\n")) {
            String trimmed = line.trim();
            if (trimmed.equals("tags:")) {
                inTags = true;
                continue;
            }
            if (inTags) {
                if (trimmed.startsWith("- ")) {
                    tags.add(trimmed.substring(2).trim());
                } else if (!trimmed.isEmpty()) {
                    inTags = false;
                }
            }
        }
        return tags;
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

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        Object val = map.get(key);
        if (val == null) return defaultValue;
        String str = val.toString();
        return str.isBlank() ? defaultValue : str;
    }

    /** 匹配到的源笔记内部数据结构 */
    private record SourceNote(String title, String content) {}
}
