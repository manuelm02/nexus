package com.nexus.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 订阅分类 AI 识别响应：返回分类名和是否为新生成的标记。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubscriptionCategorySuggestResponse {
    private String category;
    private boolean isNew;
}
