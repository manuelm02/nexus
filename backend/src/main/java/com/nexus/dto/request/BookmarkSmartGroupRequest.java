package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 书签智能分组创建/更新请求，定义分组名称、匹配模式和匹配规则。 */
@Data
public class BookmarkSmartGroupRequest {
    @NotBlank(message = "分组名称不能为空")
    private String name;
    private String description;
    /** 匹配模式：any_tag / all_tags / domain / url_pattern */
    @NotBlank(message = "匹配模式不能为空")
    private String matchMode;
    /** 逗号分隔的匹配值 */
    @NotBlank(message = "匹配值不能为空")
    private String matchValue;
    /** 排序序号 */
    private int orderIndex;
    /** 是否启用，创建时默认启用 */
    private Boolean enabled;
}
