package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 笔记合并预览响应，展示合并后的 Markdown 内容和建议输出路径。 */
@Data
public class NoteConsolidatePreviewResponse {
    /** 合并后的标题 */
    private String title;
    /** 合并后的 Markdown 内容 */
    private String markdown;
    /** 源文件路径列表 */
    private List<String> sourcePaths;
    /** 建议的输出文件路径 */
    private String suggestedPath;
}
