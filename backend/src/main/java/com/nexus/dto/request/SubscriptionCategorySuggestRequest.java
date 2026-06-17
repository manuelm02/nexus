package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 订阅分类 AI 识别请求：名称必填，备注可空辅助 AI 判断。 */
@Data
public class SubscriptionCategorySuggestRequest {
    @NotBlank(message = "订阅名称不能为空")
    private String name;

    private String notes;
}
