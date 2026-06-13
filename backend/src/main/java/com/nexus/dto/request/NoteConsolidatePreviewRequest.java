package com.nexus.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** 笔记合并预览请求，将多条笔记按指定模式合并生成合并预览。 */
@Data
public class NoteConsolidatePreviewRequest {
    /** 相对路径列表（相对于 vaultRoot） */
    @NotEmpty(message = "源文件列表不能为空")
    private List<String> sourcePaths;
    /** 合并模式：daily / topic / manual */
    private String mode;
    /** topic 模式下的主题名称 */
    private String topic;
}
