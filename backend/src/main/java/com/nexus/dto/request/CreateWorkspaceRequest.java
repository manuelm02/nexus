package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 创建 Mindbank Workspace 请求体。
 * name 必填且 1-100 字符；domainTag 和 description 可选。
 */
@Data
public class CreateWorkspaceRequest {

    @NotBlank(message = "Workspace 名称不能为空")
    @Size(max = 100, message = "Workspace 名称不能超过 100 字符")
    private String name;

    @Size(max = 50, message = "领域标签不能超过 50 字符")
    private String domainTag;

    @Size(max = 500, message = "描述不能超过 500 字符")
    private String description;
}
