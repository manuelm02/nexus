package com.nexus.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** 分组批量应用请求，将指定书签分配到指定智能分组。 */
@Data
public class BookmarkGroupApplyRequest {
    /** 要分配的书签 ID 列表 */
    @NotEmpty(message = "书签列表不能为空")
    private List<String> bookmarkIds;
    /** 目标分组 ID 列表 */
    @NotEmpty(message = "分组列表不能为空")
    private List<String> groupIds;
}
