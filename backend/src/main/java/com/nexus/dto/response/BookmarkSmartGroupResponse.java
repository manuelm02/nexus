package com.nexus.dto.response;

import com.nexus.entity.BookmarkSmartGroup;
import lombok.Data;

import java.time.LocalDateTime;

/** 书签智能分组响应，含匹配书签数量，通过静态工厂方法从实体构造。 */
@Data
public class BookmarkSmartGroupResponse {
    private String id;
    private String name;
    private String description;
    private String matchMode;
    private String matchValue;
    private int orderIndex;
    private boolean enabled;
    /** 匹配该书签分组的书签数量 */
    private int bookmarkCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * 从 BookmarkSmartGroup 实体转换为响应对象。
     *
     * @param entity 智能分组实体
     * @param count  该分组当前匹配到的书签数量
     */
    public static BookmarkSmartGroupResponse from(BookmarkSmartGroup entity, int count) {
        BookmarkSmartGroupResponse r = new BookmarkSmartGroupResponse();
        r.setId(entity.getId());
        r.setName(entity.getName());
        r.setDescription(entity.getDescription());
        r.setMatchMode(entity.getMatchMode());
        r.setMatchValue(entity.getMatchValue());
        r.setOrderIndex(entity.getOrderIndex() != null ? entity.getOrderIndex() : 0);
        r.setEnabled(entity.getEnabled() != null && entity.getEnabled());
        r.setBookmarkCount(count);
        r.setCreatedAt(entity.getCreatedAt());
        r.setUpdatedAt(entity.getUpdatedAt());
        return r;
    }
}
