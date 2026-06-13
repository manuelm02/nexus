package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** 笔记合并写入请求，将合并预览内容持久化到文件系统。 */
@Data
public class NoteConsolidateWriteRequest {
    @NotBlank(message = "标题不能为空")
    private String title;
    @NotBlank(message = "Markdown 内容不能为空")
    private String markdown;
    /** 源文件相对路径列表 */
    @NotEmpty(message = "源文件列表不能为空")
    private List<String> sourcePaths;
    /** 输出路径，为空时自动生成 */
    private String outputPath;
}
