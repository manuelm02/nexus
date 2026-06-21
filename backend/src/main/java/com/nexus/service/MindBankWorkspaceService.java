package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.CreateWorkspaceRequest;
import com.nexus.dto.request.UpdateWorkspaceRequest;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.mapper.MindBankDocumentMapper;
import com.nexus.mapper.MindBankWorkspaceMapper;
import com.nexus.port.KnowledgeBasePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Mindbank Workspace 管理服务。
 *
 * 关键设计：
 * - create 时联动调用 KnowledgeBasePort.createWorkspace() 在 AnythingLLM 创建对应工作空间，
 *   失败不回滚 DB（slug 留空后续可重试），保证 Mindbank 页面可用性优先于外部依赖。
 * - delete 时**不**调用 AnythingLLM 删除接口（避免误删向量数据，保留恢复窗口），
 *   DB 记录删除后 DB 端的 Workspace 视为下线，但 AnythingLLM 中的 workspace + embedding 仍保留。
 * - update 不联动 AnythingLLM（slug 一旦生成不再修改，避免 embedding 与工作空间名错位）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MindBankWorkspaceService {

    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankDocumentMapper documentMapper;
    private final KnowledgeBasePort knowledgeBasePort;

    /**
     * 查询所有 Workspace，按创建时间倒序。
     */
    public List<MindBankWorkspace> list() {
        return workspaceMapper.selectList(
            new LambdaQueryWrapper<MindBankWorkspace>().orderByDesc(MindBankWorkspace::getCreatedAt));
    }

    /**
     * 创建 Workspace：DB 落库 + 联动 AnythingLLM。AnythingLLM 失败时 DB 仍保留记录，slug 留空。
     *
     * @return 创建后的 entity（含自增 id 和可能的 slug）
     */
    public MindBankWorkspace create(CreateWorkspaceRequest req) {
        MindBankWorkspace workspace = new MindBankWorkspace();
        workspace.setName(req.getName());
        workspace.setDomainTag(req.getDomainTag());
        workspace.setDescription(req.getDescription());

        // 联动 AnythingLLM：失败不阻断 DB 创建，slug 留空后续可在 Update 时重试
        try {
            String slug = knowledgeBasePort.createWorkspace(req.getName(), req.getDescription());
            workspace.setAnythingllmSlug(slug);
        } catch (Exception e) {
            log.warn("AnythingLLM workspace 创建失败，slug 留空: workspace={}, err={}",
                req.getName(), e.getMessage());
        }

        workspaceMapper.insert(workspace);
        return workspace;
    }

    /**
     * 更新 Workspace 基础信息（name/domainTag/description）。
     * 不修改 anythingllmSlug 和 masterNotePath，避免外部状态错位。
     */
    public void update(Long id, UpdateWorkspaceRequest req) {
        MindBankWorkspace workspace = workspaceMapper.selectById(id);
        if (workspace == null) {
            throw new IllegalArgumentException("Workspace 不存在: id=" + id);
        }
        // PATCH 语义：只更新非 null 字段
        if (req.getName() != null) workspace.setName(req.getName());
        if (req.getDomainTag() != null) workspace.setDomainTag(req.getDomainTag());
        if (req.getDescription() != null) workspace.setDescription(req.getDescription());
        workspaceMapper.updateById(workspace);
    }

    /**
     * 删除 Workspace：仅删 DB 记录，不删 AnythingLLM workspace（保留向量数据可恢复）。
     */
    public void delete(Long id) {
        if (workspaceMapper.selectById(id) == null) {
            throw new IllegalArgumentException("Workspace 不存在: id=" + id);
        }
        workspaceMapper.deleteById(id);
    }

    /**
     * 统计指定 workspace 的文档数量（含所有流水线状态）。
     * 使用 COUNT 查询而非 selectList 避免加载全部文档。
     */
    public int countDocuments(Long workspaceId) {
        Long count = documentMapper.selectCount(
            new LambdaQueryWrapper<com.nexus.entity.MindBankDocument>()
                .eq(com.nexus.entity.MindBankDocument::getWorkspaceId, workspaceId));
        return count != null ? count.intValue() : 0;
    }
}
