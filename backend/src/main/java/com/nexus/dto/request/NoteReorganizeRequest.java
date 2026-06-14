package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 笔记标签整理请求：对指定 kind 下所有笔记重新评估标签并归位。 */
@Data
public class NoteReorganizeRequest {
    @NotBlank(message = "kind 不能为空")
    private String kind;
}
