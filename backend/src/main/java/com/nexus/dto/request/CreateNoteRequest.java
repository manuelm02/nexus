package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 新建文件/文件夹请求，path 为相对 vault 根路径的相对路径 */
@Data
public class CreateNoteRequest {
    @NotBlank
    private String path;
}
