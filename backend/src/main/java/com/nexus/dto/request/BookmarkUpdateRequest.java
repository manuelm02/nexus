package com.nexus.dto.request;

import lombok.Data;

import java.util.List;

/** 书签局部更新请求，非 null 字段才会被更新。 */
@Data
public class BookmarkUpdateRequest {
    private String title;
    private String description;
    private String notes;
    /** 标签列表，更新时替换全部标签 */
    private List<String> tags;
    /** 未读状态切换 */
    private Boolean unread;
    /** 归档状态切换 */
    private Boolean archived;
}
