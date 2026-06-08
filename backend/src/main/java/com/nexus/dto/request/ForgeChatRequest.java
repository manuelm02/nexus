package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ForgeChatRequest {
    @NotBlank(message = "消息不能为空")
    private String message;
}
