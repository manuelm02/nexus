package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Chat 流式发送消息请求。 */
@Data
public class ChatSendRequest {
    @NotBlank(message = "消息内容不能为空")
    private String message;
}
