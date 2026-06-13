package com.nexus.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** 书签批量导入预览请求，提交待导入的 URL 列表进行去重检查和分析。 */
@Data
public class BookmarkImportPreviewRequest {
    @NotEmpty(message = "导入列表不能为空")
    private List<ImportItem> items;

    /** 单条导入项 */
    @Data
    public static class ImportItem {
        private String url;
        /** 可选标题 */
        private String title;
    }
}
