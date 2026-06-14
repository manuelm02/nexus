package com.nexus.service;

import com.nexus.dto.response.NoteTagEntryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 笔记标签索引服务：读取/写入 Quick Note / Memo 各自的标签索引 Markdown 文件，
 * 供 AI 分析时复用标签、前端 TagPicker 拉取可选标签、保存笔记时写回新标签。
 * 索引文件格式为 Markdown 无序列表："- 标签名: 说明"，解析时跳过无法识别的行。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteTagIndexService {

    private final InboxSettingsService inboxSettingsService;

    /** 标签索引行格式："- 标签名: 说明"，冒号前后允许空格 */
    private static final Pattern TAG_LINE_PATTERN = Pattern.compile("^-\\s*([^:]+):\\s*(.+)$");

    /** 标签描述为空时的占位说明，提示后续人工补充 */
    private static final String PLACEHOLDER_DESCRIPTION = "（待补充说明）";

    /**
     * 读取指定笔记类型的标签索引。
     *
     * @param kind 笔记类型：quick_note / memo
     * @return 标签条目列表；索引文件不存在或 Vault 未配置时返回空列表
     */
    public List<NoteTagEntryResponse> listTags(String kind) {
        Path indexPath = resolveIndexPath(kind);
        if (indexPath == null || !Files.exists(indexPath)) {
            return List.of();
        }
        try {
            List<NoteTagEntryResponse> result = new ArrayList<>();
            for (String line : Files.readAllLines(indexPath, StandardCharsets.UTF_8)) {
                Matcher matcher = TAG_LINE_PATTERN.matcher(line.trim());
                if (matcher.matches()) {
                    NoteTagEntryResponse entry = new NoteTagEntryResponse();
                    entry.setName(matcher.group(1).trim());
                    entry.setDescription(matcher.group(2).trim());
                    result.add(entry);
                }
            }
            return result;
        } catch (IOException e) {
            log.warn("读取标签索引失败: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 将索引中尚不存在的新标签追加写入索引文件末尾。
     * 已存在的标签跳过，不更新已有说明，避免并发写入覆盖人工/历史信息。
     *
     * @param kind               笔记类型：quick_note / memo
     * @param newTagDescriptions 新标签名 -> 说明；为空时不做任何操作
     */
    public void syncNewTags(String kind, Map<String, String> newTagDescriptions) {
        if (newTagDescriptions == null || newTagDescriptions.isEmpty()) {
            return;
        }
        Path indexPath = resolveIndexPath(kind);
        if (indexPath == null) {
            return;
        }

        Set<String> existingNames = listTags(kind).stream()
                .map(NoteTagEntryResponse::getName)
                .collect(Collectors.toSet());

        StringBuilder toAppend = new StringBuilder();
        for (Map.Entry<String, String> entry : newTagDescriptions.entrySet()) {
            String name = entry.getKey() == null ? "" : entry.getKey().trim();
            if (name.isEmpty() || existingNames.contains(name)) {
                continue;
            }
            String description = entry.getValue() == null || entry.getValue().isBlank()
                    ? PLACEHOLDER_DESCRIPTION : entry.getValue().trim();
            toAppend.append("- ").append(name).append(": ").append(description).append("\n");
            existingNames.add(name);
        }
        if (toAppend.length() == 0) {
            return;
        }

        try {
            if (!Files.exists(indexPath)) {
                Files.createDirectories(indexPath.getParent());
                String title = "memo".equals(kind) ? "Memo" : "Quick Note";
                Files.writeString(indexPath, "# " + title + " 标签索引\n\n", StandardCharsets.UTF_8);
            }
            Files.writeString(indexPath, toAppend.toString(), StandardCharsets.UTF_8, StandardOpenOption.APPEND);
        } catch (IOException e) {
            log.warn("写入标签索引失败: {}", e.getMessage());
        }
    }

    /**
     * 解析标签索引文件路径，并校验在 Vault 范围内（防路径穿越）。
     * Vault 未配置时返回 null，由调用方降级处理。
     */
    private Path resolveIndexPath(String kind) {
        String vaultPath = inboxSettingsService.get("inbox.obsidian.vault_path");
        if (vaultPath == null || vaultPath.isBlank()) {
            return null;
        }
        String tagsDir = inboxSettingsService.getObsidianTagsDir();
        String fileName = "memo".equals(kind) ? "memo-tags.md" : "quick-note-tags.md";

        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path filePath = vaultRoot.resolve(tagsDir).resolve(fileName).normalize().toAbsolutePath();
        if (!filePath.startsWith(vaultRoot)) {
            throw new SecurityException("标签索引路径不在 Obsidian Vault 范围内");
        }
        return filePath;
    }
}
