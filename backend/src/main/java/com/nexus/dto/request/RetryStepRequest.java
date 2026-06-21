package com.nexus.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 重试 Mindbank 文档某一步骤的请求体。
 * step 范围 1-5，对应 5 步流水线。
 */
@Data
public class RetryStepRequest {

    @NotNull(message = "step 不能为空")
    @Min(value = 1, message = "step 不能小于 1")
    @Max(value = 5, message = "step 不能大于 5")
    private Integer step;
}
