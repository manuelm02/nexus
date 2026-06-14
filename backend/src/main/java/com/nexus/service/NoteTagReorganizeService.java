package com.nexus.service;

import com.nexus.dto.request.NoteReorganizeRequest;
import com.nexus.dto.response.NoteReorganizeResponse;
import com.nexus.dto.response.NoteReorganizeResponse.NoteReorganizeChange;
import com.nexus.dto.response.NoteTagSuggestionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * 笔记标签整理服务：扫描指定 kind（quick_note/memo）下所有笔记，
 * 对每篇笔记重新调用 AI 单标签建议，若标签发生变化则将笔记文件移动到新的
 * "{tag}/" 目录并更新 front matter 中的 tags 字段。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteTagReorganizeService {

    private final InboxSettingsService inboxSettingsService;
    private final NoteAiService noteAiService;
    private final NoteTagIndexService noteTagIndexService;

    /**
     * 对指定 kind 下所有笔记重新评估标签并归位。
     * AI 不可用或 Vault 未配置/笔记目录不存在时直接返回空结果，不做任何文件改动。
     *
     * @param req 整理请求，kind 必填（quick_note / memo）
     * @return 整理结果：扫描数量、变更列表、AI 是否可用
     */
    public NoteReorganizeResponse reorganize(NoteReorganizeRequest req) {
        NoteReorganizeResponse resp = new NoteReorganizeResponse();

        // AI 不可用时无法重新评估标签，直接返回，避免误判后批量移动文件
        if (!inboxSettingsService.isInboxAiAvailable()) {
            resp.setScannedCount(0);
            resp.setChanges(List.of());
            resp.setAiUnavailable(true);
            return resp;
        }

        String vaultPath = inboxSettingsService.get("inbox.obsidian.vault_path");
        if (vaultPath == null || vaultPath.isBlank()) {
            resp.setScannedCount(0);
            resp.setChanges(List.of());
            resp.setAiUnavailable(false);
            return resp;
        }

        String noteDir = "memo".equals(req.getKind())
                ? inboxSettingsService.getObsidianMemoDir()
                : inboxSettingsService.getObsidianQuickNoteDir();

        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path noteRoot = vaultRoot.resolve(noteDir).normalize().toAbsolutePath();
        // 防路径穿越：确保笔记根目录在 vault 范围内
        if (!noteRoot.startsWith(vaultRoot) || !Files.isDirectory(noteRoot)) {
            resp.setScannedCount(0);
            resp.setChanges(List.of());
            resp.setAiUnavailable(false);
            return resp;
        }

        List<Path> files;
        try (Stream<Path> paths = Files.walk(noteRoot)) {
            files = paths.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".md"))
                    .toList();
        } catch (IOException e) {
            log.warn("扫描笔记目录失败: {}", e.getMessage());
            files = List.of();
        }

        List<NoteReorganizeChange> changes = new ArrayList<>();
        // 本轮所有新标签的说明，最后一次性同步到标签索引，避免多次写文件
        Map<String, String> newTagDescriptions = new LinkedHashMap<>();

        for (Path path : files) {
            try {
                processNote(req, vaultRoot, noteRoot, path, changes, newTagDescriptions);
            } catch (IOException e) {
                // 单个文件处理失败不影响整体流程；已移动的文件保持已移动状态（已知限制）
                log.warn("整理笔记标签失败，已跳过: {} - {}", path, e.getMessage());
            }
        }

        noteTagIndexService.syncNewTags(req.getKind(), newTagDescriptions);

        resp.setScannedCount(files.size());
        resp.setChanges(changes);
        resp.setAiUnavailable(false);
        return resp;
    }

    /**
     * 处理单篇笔记：读取内容、调用 AI 重新建议标签，若标签变化则移动文件并更新 front matter。
     */
    private void processNote(NoteReorganizeRequest req, Path vaultRoot, Path noteRoot, Path path,
                              List<NoteReorganizeChange> changes, Map<String, String> newTagDescriptions) throws IOException {
        String content = Files.readString(path, StandardCharsets.UTF_8);
        String body = stripFrontMatter(content);
        String title = extractTitleFromContent(content);
        List<String> tags = extractTagsFromFrontMatter(content);
        String oldTag = tags.isEmpty() ? "" : tags.get(0);

        NoteTagSuggestionResponse suggestion = noteAiService.suggestSingleTag(body, req.getKind());
        String newTag = suggestion.getName();

        // 标签未变化，跳过（区分大小写的字符串相等比较）
        if (newTag.equals(oldTag)) {
            return;
        }

        Path newDir = noteRoot.resolve(slugify(newTag));
        Files.createDirectories(newDir);

        String fileName = resolveFileName(newDir, path.getFileName().toString());
        Path newPath = newDir.resolve(fileName);

        // 先移动再重写内容：若移动失败，原文件保持原目录、原 front matter 不变，不会出现
        // "front matter 已更新但文件仍留在旧目录"的中间态
        String newContent = replaceTagsInFrontMatter(content, newTag);
        Files.move(path, newPath);
        Files.writeString(newPath, newContent, StandardCharsets.UTF_8);

        if (suggestion.getDescription() != null) {
            newTagDescriptions.put(newTag, suggestion.getDescription());
        }

        NoteReorganizeChange change = new NoteReorganizeChange();
        change.setTitle(title);
        change.setOldTag(oldTag);
        change.setNewTag(newTag);
        change.setOldPath(vaultRoot.relativize(path).toString());
        change.setNewPath(vaultRoot.relativize(newPath).toString());
        changes.add(change);
    }

    /**
     * 解析目标目录下不冲突的文件名：若 {fileName} 已存在，依次尝试 {base}-2.{ext}、-3.{ext}...
     * 与 ObsidianMarkdownWriter.resolveFileName 逻辑一致。
     */
    private String resolveFileName(Path targetDir, String fileName) {
        if (!Files.exists(targetDir.resolve(fileName))) {
            return fileName;
        }
        String base = fileName;
        String ext = "";
        int dot = fileName.lastIndexOf('.');
        if (dot >= 0) {
            base = fileName.substring(0, dot);
            ext = fileName.substring(dot);
        }
        int seq = 2;
        String candidate;
        do {
            candidate = base + "-" + seq + ext;
            seq++;
        } while (Files.exists(targetDir.resolve(candidate)));
        return candidate;
    }

    /**
     * 重写 front matter 中的 tags 字段为 [newTag]，其余字段保持不变。
     * 若原内容没有 front matter，则按 ObsidianMarkdownWriter.buildMarkdown 风格新增一个最小 front matter。
     */
    private String replaceTagsInFrontMatter(String content, String newTag) {
        if (content == null || !content.trim().startsWith("---")) {
            return "---\ntags:\n  - " + newTag + "\n---\n\n" + (content != null ? content : "");
        }
        int end = content.indexOf("---", 3);
        if (end < 0) {
            return "---\ntags:\n  - " + newTag + "\n---\n\n" + content;
        }
        String frontMatter = content.substring(0, end);
        String rest = content.substring(end);

        // 移除现有的 tags 块（"tags:" 行及其后所有 "  - xxx" 行），保留其余字段顺序不变
        StringBuilder rebuilt = new StringBuilder();
        String[] lines = frontMatter.split("\\n", -1);
        boolean inTags = false;
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.equals("tags:")) {
                inTags = true;
                continue;
            }
            if (inTags) {
                if (trimmed.startsWith("- ")) {
                    continue;
                } else {
                    inTags = false;
                }
            }
            rebuilt.append(line).append("\n");
        }
        // 去除末尾多余空行后追加新的 tags 字段
        String fm = rebuilt.toString();
        while (fm.endsWith("\n\n")) {
            fm = fm.substring(0, fm.length() - 1);
        }
        if (!fm.endsWith("\n")) {
            fm += "\n";
        }
        fm += "tags:\n  - " + newTag + "\n";

        return fm + rest;
    }

    /**
     * 将标签转为目录名的 slug，与 ObsidianMarkdownWriter.slugify 完全一致：
     * 中文保留原样，特殊字符/空格替换为连字符。
     */
    private String slugify(String input) {
        if (input == null || input.isBlank()) return "note";
        return input.trim()
                .replaceAll("[\\\\/:*?\"<>|\\s]+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
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
}
