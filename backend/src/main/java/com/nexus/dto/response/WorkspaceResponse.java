package com.nexus.dto.response;

import com.nexus.entity.MindBankWorkspace;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Mindbank Workspace 详情响应。包含：
 * - 基础信息：id、name、domainTag、description、createdAt
 * - 同步状态：anythingllmSlug（AnythingLLM 工作空间标识）、masterNotePath
 * - 统计：documentCount（挂载到该 workspace 的文档总数）
 *
 * 由 MindBankWorkspaceService 在返回前从 entity 转换为 DTO，避免直接序列化 entity 暴露内部字段。
 */
@Data
public class WorkspaceResponse {

    private Long id;
    private String name;
    private String domainTag;
    private String description;
    private String anythingllmSlug;
    private String masterNotePath;
    private Integer documentCount;
    private LocalDateTime createdAt;

    /**
     * MindBankWorkspace entity → DTO 转换。
     * documentCount 由调用方在转换后通过 setter 注入（避免在 mapper 内部产生额外查询）。
     */
    public static WorkspaceResponse fromEntity(MindBankWorkspace w, int documentCount) {
        WorkspaceResponse r = new WorkspaceResponse();
        r.setId(w.getId());
        r.setName(w.getName());
        r.setDomainTag(w.getDomainTag());
        r.setDescription(w.getDescription());
        r.setAnythingllmSlug(w.getAnythingllmSlug());
        r.setMasterNotePath(w.getMasterNotePath());
        r.setDocumentCount(documentCount);
        r.setCreatedAt(w.getCreatedAt());
        return r;
    }
}
