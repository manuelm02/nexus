package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 书签标签汇总响应，列出所有标签及其使用次数。 */
@Data
public class BookmarkTagSummaryResponse {
    private List<TagInfo> tags;

    /** 标签信息 */
    @Data
    public static class TagInfo {
        private String name;
        /** 使用该标签的书签数量 */
        private int count;
    }
}
