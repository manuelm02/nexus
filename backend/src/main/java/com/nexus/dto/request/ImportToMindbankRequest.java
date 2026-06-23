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
    /** 可选：用户在导入弹窗指定的 Step 2 整理模板，空值时 Pipeline 使用当前默认模板。 */
    private Long promptTemplateId;
}
