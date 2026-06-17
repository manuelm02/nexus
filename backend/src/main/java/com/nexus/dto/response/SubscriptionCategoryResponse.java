package com.nexus.dto.response;

import com.nexus.entity.SubscriptionCategory;
import lombok.Data;

import java.time.LocalDateTime;

/** 订阅分类响应。 */
@Data
public class SubscriptionCategoryResponse {
    private String id;
    private String name;
    private LocalDateTime createdAt;

    public static SubscriptionCategoryResponse from(SubscriptionCategory entity) {
        SubscriptionCategoryResponse resp = new SubscriptionCategoryResponse();
        resp.setId(entity.getId());
        resp.setName(entity.getName());
        resp.setCreatedAt(entity.getCreatedAt());
        return resp;
    }
}
