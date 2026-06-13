package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 书签批量导入执行结果，返回创建/更新/跳过的计数和新建书签 ID 列表。 */
@Data
public class BookmarkImportCommitResponse {
    private int createdCount;
    private int updatedCount;
    private int skippedCount;
    /** 本次新建的书签 ID 列表 */
    private List<String> createdBookmarkIds;
}
