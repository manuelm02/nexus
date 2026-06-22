package com.nexus.dto.response;

import com.nexus.entity.MindBankPromptTemplate;
import lombok.Data;

import java.time.LocalDateTime;

/** Prompt 模板详情响应 */
@Data
public class PromptTemplateResponse {
    private Long id;
    private String name;
    private String promptType;
    private String content;
    private Boolean defaultFlag;
    private Boolean builtinFlag;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static PromptTemplateResponse fromEntity(MindBankPromptTemplate t) {
        PromptTemplateResponse r = new PromptTemplateResponse();
        r.setId(t.getId());
        r.setName(t.getName());
        r.setPromptType(t.getPromptType());
        r.setContent(t.getContent());
        r.setDefaultFlag(t.getDefaultFlag());
        r.setBuiltinFlag(t.getBuiltinFlag());
        r.setCreatedAt(t.getCreatedAt());
        r.setUpdatedAt(t.getUpdatedAt());
        return r;
    }
}
