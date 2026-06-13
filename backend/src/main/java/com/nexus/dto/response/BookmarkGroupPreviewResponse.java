package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 智能分组预览响应，按分组展示匹配到的书签列表。 */
@Data
public class BookmarkGroupPreviewResponse {
    private List<GroupPreview> groups;

    /** 单个分组的预览结果 */
    @Data
    public static class GroupPreview {
        private String groupId;
        private String groupName;
        private String matchMode;
        /** 匹配到的书签数量 */
        private int matchedCount;
        /** 匹配到的书签列表 */
        private List<MatchedBookmark> matchedBookmarks;
    }

    /** 匹配到的书签信息 */
    @Data
    public static class MatchedBookmark {
        private String bookmarkId;
        private String title;
        private String url;
        private String domain;
        /** 是否已经分配了该组 */
        private boolean alreadyAssigned;
    }
}
