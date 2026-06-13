package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/** 书签创建请求。URL 必填且必须 http:// 或 https:// 开头。 */
@Data
public class BookmarkCreateRequest {
    @NotBlank(message = "URL 不能为空")
    private String url;
    /** 可选标题，为空时前端用 URL domain 兜底 */
    private String title;
    private String description;
    private String notes;
    /** 标签列表，入库前去空、trim、去重 */
    private List<String> tags;
}
