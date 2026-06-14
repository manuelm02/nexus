package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/** 书签智能分析请求，提交 URL 供 AI 分析生成标题、描述、标签等建议。 */
@Data
public class BookmarkAnalyzeRequest {
    @NotBlank(message = "URL 不能为空")
    private String url;
    /** 用户提供的可选标题 */
    private String title;
    /** 现有标签，供 AI 参考以保持命名一致性 */
    private List<String> existingTags;
}
