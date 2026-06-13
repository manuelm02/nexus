package com.nexus.dto.response;

import com.nexus.entity.Bookmark;
import lombok.Data;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

/** 书签响应，domain 从 URL 解析得出，避免冗余存储。 */
@Data
public class BookmarkResponse {
    private String id;
    private String url;
    private String title;
    private String description;
    private String notes;
    private List<String> tagNames;
    private boolean unread;
    private boolean archived;
    /** 从 URL 解析的域名，不入库 */
    private String domain;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** 从 Bookmark 实体转换为响应对象，domain 运行时计算 */
    public static BookmarkResponse from(Bookmark b) {
        BookmarkResponse r = new BookmarkResponse();
        r.setId(b.getId());
        r.setUrl(b.getUrl());
        r.setTitle(b.getTitle());
        r.setDescription(b.getDescription());
        r.setNotes(b.getNotes());
        r.setTagNames(b.getTags() != null ? b.getTags() : Collections.emptyList());
        r.setUnread(b.isUnread());
        r.setArchived(b.isArchived());
        r.setDomain(extractDomain(b.getUrl()));
        r.setCreatedAt(b.getCreatedAt());
        r.setUpdatedAt(b.getUpdatedAt());
        return r;
    }

    /**
     * 从 URL 中提取域名，解析失败返回原始 URL 截断。
     * 第一版简单实现，不做复杂的 TLD 解析。
     */
    private static String extractDomain(String url) {
        if (url == null) return "";
        try {
            URI uri = new URI(url);
            String host = uri.getHost();
            return host != null ? host : url;
        } catch (Exception e) {
            return url;
        }
    }
}
