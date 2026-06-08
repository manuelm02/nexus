package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FocusStatusRequest {
    @NotBlank(message = "状态不能为空")
    private String status;  // not_started|in_progress|done|archived
}
