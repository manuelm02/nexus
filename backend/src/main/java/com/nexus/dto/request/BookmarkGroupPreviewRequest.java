package com.nexus.dto.request;

import lombok.Data;

import java.util.List;

/** 智能分组预览请求，可选择指定书签或分组范围进行匹配预览。 */
@Data
public class BookmarkGroupPreviewRequest {
    /** 要预览的书签 ID 列表，null 或空表示全部书签 */
    private List<String> bookmarkIds;
    /** 要预览的分组 ID 列表，null 或空表示全部已启用分组 */
    private List<String> groupIds;
}
