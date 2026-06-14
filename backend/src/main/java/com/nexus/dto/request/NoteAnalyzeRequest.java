package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/** 笔记 AI 分析请求，提交笔记内容供 AI 生成标题、分类、标签和待办项。 */
@Data
public class NoteAnalyzeRequest {
    private String title;
    @NotBlank(message = "内容不能为空")
    private String content;
    /** 笔记类型：quick_note / memo */
    private String kind;
    /** 现有标签，供 AI 参考 */
    private List<String> tags;
}
