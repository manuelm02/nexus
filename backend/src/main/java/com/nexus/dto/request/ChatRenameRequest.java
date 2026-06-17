package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Chat 会话重命名请求；titleAi=false 表示用户手动确认，后续 AI 不再覆盖。 */
@Data
public class ChatRenameRequest {
    @NotBlank(message = "标题不能为空")
    private String title;
    private Boolean titleAi;
}
