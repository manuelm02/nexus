package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 重命名请求，oldPath 和 newPath 均为相对 vault 根路径的相对路径 */
@Data
public class RenameNoteRequest {
    @NotBlank
    private String oldPath;
    @NotBlank
    private String newPath;
}
