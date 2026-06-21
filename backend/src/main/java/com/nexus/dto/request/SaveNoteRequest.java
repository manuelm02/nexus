package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 保存文件内容请求 */
@Data
public class SaveNoteRequest {
    @NotBlank
    private String path;
    @NotBlank
    private String content;
}
