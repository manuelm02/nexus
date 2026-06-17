package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 创建订阅分类请求：名称必填。 */
@Data
public class SubscriptionCategoryCreateRequest {
    @NotBlank(message = "分类名称不能为空")
    private String name;
}
