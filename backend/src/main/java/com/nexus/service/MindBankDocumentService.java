package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.MindBankDocument;
import com.nexus.mapper.MindBankDocumentMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Mindbank 文档管理服务。
 *
 * 文档由 Crawl 阶段（CrawlService）创建并上传 MinIO 后挂载到 Workspace，
 * Phase 6.5 本服务只负责查询和重置流水线状态，Pipeline 实际执行在 Phase 6.6 接入
 * （届时本类的 retryStep 会改为调用 MindBankPipelineService.retryStep()）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MindBankDocumentService {

    private final MindBankDocumentMapper documentMapper;

    /**
     * 查询指定 workspace 下所有文档，按创建时间倒序。
     * 不分页：Mindbank 页面典型使用场景单 workspace 文档数量在 100 以内，
     * 后续如出现性能问题再加分页。
     */
    public List<MindBankDocument> listByWorkspace(Long workspaceId) {
        return documentMapper.selectList(
            new LambdaQueryWrapper<MindBankDocument>()
                .eq(MindBankDocument::getWorkspaceId, workspaceId)
                .orderByDesc(MindBankDocument::getCreatedAt));
    }

    /**
     * 查询单个文档的完整状态（5 步流水线 + 错误信息）。
     */
    public MindBankDocument getStatus(Long docId) {
        MindBankDocument doc = documentMapper.selectById(docId);
        if (doc == null) {
            throw new IllegalArgumentException("文档不存在: id=" + docId);
        }
        return doc;
    }

    /**
     * 重置指定步骤及后续步骤状态为 pending，清空错误信息，将 pipelineStatus 置为 processing。
     * Phase 6.6 接入 Pipeline 后会改为同步调用 MindBankPipelineService.retryStep() 触发实际执行。
     *
     * @param docId 文档 ID
     * @param step  1-5
     */
    public void retryStep(Long docId, int step) {
        if (step < 1 || step > 5) {
            throw new IllegalArgumentException("step 必须在 1-5 之间: " + step);
        }
        MindBankDocument doc = documentMapper.selectById(docId);
        if (doc == null) {
            throw new IllegalArgumentException("文档不存在: id=" + docId);
        }

        // 重置 step 及后续所有步骤为 pending（包含 step 本身）
        if (step <= 1) doc.setStep1Status("pending");
        if (step <= 2) doc.setStep2Status("pending");
        if (step <= 3) doc.setStep3Status("pending");
        if (step <= 4) doc.setStep4Status("pending");
        if (step <= 5) doc.setStep5Status("pending");

        doc.setPipelineStatus("processing");
        doc.setStepErrorMsg(null);
        documentMapper.updateById(doc);

        // TODO Phase 6.6: 调用 mindBankPipelineService.retryStep(docId, step) 触发实际执行
        log.info("文档 {} 步骤 {} 及后续已重置为 pending（Pipeline 触发待 Phase 6.6）", docId, step);
    }
}
