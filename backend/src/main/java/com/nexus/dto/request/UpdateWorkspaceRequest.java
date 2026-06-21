package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 更新 Mindbank Workspace 请求体。所有字段都是可选的（PATCH 语义），
 * 但调用方应至少提供一个非空字段以避免空请求。
 */
@Data
public class UpdateWorkspaceRequest {

    @Size(max = 100, message = "Workspace 名称不能超过 100 字符")
    private String name;

    @Size(max = 50, message = "领域标签不能超过 50 字符")
    private String domainTag;

    @Size(max = 500, message = "描述不能超过 500 字符")
    private String description;
}
