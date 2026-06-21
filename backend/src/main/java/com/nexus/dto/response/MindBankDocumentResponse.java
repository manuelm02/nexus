package com.nexus.dto.response;

import com.nexus.entity.MindBankDocument;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Mindbank 文档详情响应。
 *
 * 包含：文件元信息、MinIO 路径、5 步流水线状态、错误信息、Session Note 路径、创建时间。
 *
 * 注意：与 paperless 的 DocumentResponse 职责不同（DMS 文档元信息 vs Mindbank 流水线文档状态），
 * 不复用同名 DTO，避免后续字段合并造成的语义混乱。
 */
@Data
public class MindBankDocumentResponse {

    private Long id;
    private Long workspaceId;
    private String fileName;
    private String sourceType;
    private String originalMinioKey;
    private String processedMinioKey;
    private String contentTypeTag;
    private String pipelineStatus;
    private String step1Status;
    private String step2Status;
    private String step3Status;
    private String step4Status;
    private String step5Status;
    private String stepErrorMsg;
    private String sessionNotePath;
    private Long promptTemplateId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** MindBankDocument entity → DTO 转换 */
    public static MindBankDocumentResponse fromEntity(MindBankDocument d) {
        MindBankDocumentResponse r = new MindBankDocumentResponse();
        r.setId(d.getId());
        r.setWorkspaceId(d.getWorkspaceId());
        r.setFileName(d.getFileName());
        r.setSourceType(d.getSourceType());
        r.setOriginalMinioKey(d.getOriginalMinioKey());
        r.setProcessedMinioKey(d.getProcessedMinioKey());
        r.setContentTypeTag(d.getContentTypeTag());
        r.setPipelineStatus(d.getPipelineStatus());
        r.setStep1Status(d.getStep1Status());
        r.setStep2Status(d.getStep2Status());
        r.setStep3Status(d.getStep3Status());
        r.setStep4Status(d.getStep4Status());
        r.setStep5Status(d.getStep5Status());
        r.setStepErrorMsg(d.getStepErrorMsg());
        r.setSessionNotePath(d.getSessionNotePath());
        r.setPromptTemplateId(d.getPromptTemplateId());
        r.setCreatedAt(d.getCreatedAt());
        r.setUpdatedAt(d.getUpdatedAt());
        return r;
    }
}
