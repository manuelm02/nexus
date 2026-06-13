package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 笔记 AI 分析响应，包含 AI 生成的标题、分类、标签、清洗后 Markdown 及待办项。 */
@Data
public class NoteAnalyzeResponse {
    /** AI 建议标题 */
    private String suggestedTitle;
    /** AI 建议笔记类型：quick_note / memo */
    private String suggestedKind;
    /** AI 建议标签 */
    private List<String> suggestedTags;
    /** AI 建议分类 */
    private String suggestedCategory;
    /** AI 建议的 Obsidian 子文件夹 */
    private String suggestedFolder;
    /** AI 清洗后的 Markdown */
    private String cleanedMarkdown;
    /** AI 提取的待办项 */
    private List<ActionItem> actionItems;
    /** LLM 是否可用 */
    private boolean aiAvailable;
    /** 置信度：high / medium / low */
    private String confidence;

    /** AI 提取的待办项 */
    @Data
    public static class ActionItem {
        private String description;
        /** 优先级：high / medium / low */
        private String priority;
    }
}
