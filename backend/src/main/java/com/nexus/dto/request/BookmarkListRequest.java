package com.nexus.dto.request;

import lombok.Data;

/** 书签列表查询请求，支持多条件组合筛选和分页。 */
@Data
public class BookmarkListRequest {
    /** 搜索关键词，匹配 title/url/description/notes/tags */
    private String q;
    /** 按标签筛选 */
    private String tag;
    /** 按智能分组 ID 筛选 */
    private String groupId;
    /** 归档状态筛选：null=全部，true=已归档，false=未归档 */
    private Boolean archived;
    /** 未读状态筛选：null=全部，true=未读，false=已读 */
    private Boolean unread;
    /** 页码，从 1 开始，默认 1 */
    private Integer page = 1;
    /** 每页条数，默认 20 */
    private Integer size = 20;
}
