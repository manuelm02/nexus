package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TodoStatusRequest {
    @NotBlank(message = "状态不能为空")
    private String status;  // pending|cancelled|not_started|in_progress|done
}
