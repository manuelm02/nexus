package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MindbankChatRequest {
    @NotBlank(message = "问题不能为空")
    private String question;

    private String domain;  // null = 全库搜索

    private String sessionId;
}
