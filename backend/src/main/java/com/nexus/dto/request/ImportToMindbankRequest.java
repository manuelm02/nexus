package com.nexus.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** 导入文件到 Mindbank Workspace 的请求体 */
@Data
public class ImportToMindbankRequest {
    @NotNull
    private Long docId;
    @NotNull
    private Long workspaceId;
}
