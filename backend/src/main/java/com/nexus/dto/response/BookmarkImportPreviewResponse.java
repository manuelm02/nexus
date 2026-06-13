package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 书签批量导入预览响应，展示导入项的去重、分析和冲突检测结果。 */
@Data
public class BookmarkImportPreviewResponse {
    /** 预览会话标识，commit 时需回传以关联预览数据 */
    private String importSessionId;
    /** 汇总统计 */
    private ImportSummary summary;
    /** 可创建的新书签 */
    private List<ImportPreviewItem> createItems;
    /** 完全重复，跳过 */
    private List<ImportPreviewItem> skipItems;
    /** URL 相同但标题不同的冲突项 */
    private List<ConflictPreviewItem> conflictItems;
    /** 格式无效的项 */
    private List<InvalidPreviewItem> invalidItems;

    /** 导入汇总统计 */
    @Data
    public static class ImportSummary {
        private int totalCount;
        private int createCount;
        private int skipCount;
        private int conflictCount;
        private int invalidCount;
    }

    /** 待创建书签的预览信息，包含 AI 分析结果 */
    @Data
    public static class ImportPreviewItem {
        /** 原始导入数据索引 */
        private int sourceIndex;
        private String url;
        private String title;
        private String normalizedUrl;
        private String domain;
        private String suggestedTitle;
        private String suggestedDescription;
        private List<String> suggestedTags;
        private String suggestedGroupId;
        private String suggestedGroupName;
        /** LLM 是否可用 */
        private boolean aiAvailable;
    }

    /** 冲突项预览，新旧标题对比 */
    @Data
    public static class ConflictPreviewItem {
        private int sourceIndex;
        private String url;
        /** 新标题 */
        private String title;
        private String normalizedUrl;
        private String existingBookmarkId;
        private String existingTitle;
        private String existingUrl;
        private boolean aiAvailable;
        /** AI 判定：same / different / low_confidence */
        private String aiVerdict;
    }

    /** 无效导入项 */
    @Data
    public static class InvalidPreviewItem {
        private int sourceIndex;
        private String url;
        private String title;
        /** 无效原因 */
        private String reason;
    }
}
