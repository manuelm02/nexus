package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 书签智能分析响应，包含 AI 生成的建议和去重/分组匹配结果。 */
@Data
public class BookmarkAnalyzeResponse {
    private String originalUrl;
    private String normalizedUrl;
    /** 被移除的追踪参数列表 */
    private List<String> trackingParamsRemoved;
    private String domain;
    /** AI 建议标题 */
    private String suggestedTitle;
    /** AI 建议描述 */
    private String suggestedDescription;
    /** AI 建议标签 */
    private List<String> suggestedTags;
    /** AI 建议的分组 ID */
    private String suggestedGroupId;
    /** AI 建议的分组名称 */
    private String suggestedGroupName;
    /** 重复状态：none / exact_duplicate / possible_conflict */
    private String duplicateStatus;
    /** 可能的冲突书签 */
    private BookmarkResponse conflictCandidate;
    /** LLM 是否可用 */
    private boolean aiAvailable;
    /** 置信度：high / medium / low */
    private String confidence;
    /** 规则匹配的分组列表 */
    private List<GroupSuggestion> matchedGroups;

    /** 分组匹配建议，包含匹配原因说明 */
    @Data
    public static class GroupSuggestion {
        private String groupId;
        private String groupName;
        /** 匹配原因，标注使用的规则类型 */
        private String matchReason;
    }
}
