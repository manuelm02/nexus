package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.MindBankDocument;
import com.nexus.entity.MindBankPromptTemplate;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.mapper.MindBankDocumentMapper;
import com.nexus.mapper.MindBankPromptTemplateMapper;
import com.nexus.mapper.MindBankWorkspaceMapper;
import com.nexus.port.KnowledgeBasePort;
import com.nexus.port.NotePort;
import com.nexus.port.StoragePort;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Mindbank 5 步确定性入库 Pipeline。
 * 高频、无人值守地把材料变成知识。通过 Port 接口操作外部系统。
 *
 * Step 1：内容类型识别（最快模型）
 * Step 2：AI 融合整理 → 更新 Master Note（最强模型，单次 Prompt，不接 Agent A）
 * Step 3：AI 生成 Session Note（中等模型）
 * Step 4：写入 Obsidian vault（通过 NotePort）
 * Step 5：更新 AnythingLLM embedding（通过 KnowledgeBasePort）
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankPipelineService {

    private final StoragePort storagePort;
    private final NotePort notePort;
    private final KnowledgeBasePort knowledgeBasePort;
    private final LlmConfigService llmConfigService;
    private final MindBankDocumentMapper documentMapper;
    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankPromptTemplateMapper promptTemplateMapper;
    private final SystemConfigService systemConfigService;
    private final MindBankMergeCheckAgent mergeCheckAgent;

    private final ConcurrentHashMap<Long, Map<String, String>> stepCache = new ConcurrentHashMap<>();

    /**
     * 异步触发完整 Pipeline（5 步顺序执行）。
     * 由 CrawlService.importToWorkspace 在文档挂载到 Workspace 后调用。
     */
    @Async("mindBankPipelineExecutor")
    public void triggerAsync(Long documentId) {
        updatePipelineStatus(documentId, "processing");
        try {
            runStep(documentId, 1);
            runStep(documentId, 2);
            runStep(documentId, 3);
            runStep(documentId, 4);
            runStep(documentId, 5);
            updatePipelineStatus(documentId, "done");
        } catch (Exception e) {
            log.error("Pipeline failed for document {}: {}", documentId, e.getMessage(), e);
            updatePipelineStatus(documentId, "failed");
        } finally {
            stepCache.remove(documentId);
        }
    }

    /**
     * 从指定步骤开始重新执行（重置该步及后续状态为 pending）。
     * 注意：此方法同步执行 DB 重置；Pipeline 实际重跑由 Controller 层调用 triggerAsync 触发。
     */
    public void retryStep(Long documentId, int step) {
        resetStepsFrom(documentId, step);
        updatePipelineStatus(documentId, "processing");
    }

    private void runStep(Long documentId, int step) {
        updateStepStatus(documentId, step, "processing");
        try {
            switch (step) {
                case 1 -> step1Classify(documentId);
                case 2 -> step2Organize(documentId);
                case 3 -> step3SessionNote(documentId);
                case 4 -> step4WriteObsidian(documentId);
                case 5 -> step5Embed(documentId);
            }
            updateStepStatus(documentId, step, "done");
        } catch (Exception e) {
            updateStepStatus(documentId, step, "failed", e.getMessage());
            throw new RuntimeException("Step " + step + " failed: " + e.getMessage(), e);
        }
    }

    // ==================== Step 1：内容类型识别 ====================

    private void step1Classify(Long docId) {
        MindBankDocument doc = getDoc(docId);
        String content = storagePort.readProcessed(doc.getProcessedMinioKey());
        String preview = content.substring(0, Math.min(500, content.length()));

        String prompt = """
            分析以下内容的前500字，判断它最接近哪种类型：
            A. 学术论文/研究报告  B. 技术教程/官方文档
            C. 新闻/博客文章     D. 书籍章节/读书笔记
            E. 会议记录/工作文档 F. 其他

            内容：
            """ + preview + "\n\n只返回字母，不需要解释。";

        ChatLanguageModel model = llmConfigService.resolveModel("mindbank_classify");
        String result = model.generate(prompt).trim().toUpperCase();
        String typeTag = result.isEmpty() ? "F" : result.substring(0, 1);

        MindBankDocument update = new MindBankDocument();
        update.setId(docId);
        update.setContentTypeTag(typeTag);
        documentMapper.updateById(update);
    }

    // ==================== Step 2：AI 整理 → 更新 Master Note ====================

    /**
     * Step 2：AI 融合整理 → 更新 Master Note。
     * 三分支策略：
     * 1. 首次导入（无 Master Note）→ 单次 Prompt（organize_init 模板）
     * 2. 简单材料（< 1500 字符）→ 单次 Prompt（organize_merge 模板）
     * 3. 复杂材料（≥ 1500 字符）→ Agent A 多轮融合自检，失败时回退到单次 Prompt
     *
     * Agent A 失败回退是关键设计：不能让 Agent 问题导致整个 Pipeline 失败。
     */
    private void step2Organize(Long docId) {
        MindBankDocument doc = getDoc(docId);
        MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());

        String newContent = storagePort.readProcessed(doc.getProcessedMinioKey());
        String existingMaster = notePort.readMaster(workspace.getName());
        boolean hasMasterNote = existingMaster != null && !existingMaster.isBlank();

        String masterNoteContent;

        if (!hasMasterNote) {
            // 首次导入：走原始单次 Prompt（organize_init 模板）
            String promptTemplate = getDefaultPromptTemplate("organize_init");
            String prompt = promptTemplate
                .replace("{content}", newContent)
                .replace("{source_url}", buildMinioUrl(doc.getOriginalMinioKey()))
                .replace("{timestamp}", LocalDateTime.now().toString())
                .replace("{workspace_name}", workspace.getName());
            ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
            masterNoteContent = generateWithChunking(model, prompt, newContent);

        } else if (newContent.length() < 1500) {
            // 简单材料：走原始单次 Prompt（organize_merge 模板）
            String promptTemplate = getDefaultPromptTemplate("organize_merge");
            String prompt = promptTemplate
                .replace("{master_note}", existingMaster)
                .replace("{new_content}", newContent)
                .replace("{document_name}", doc.getFileName())
                .replace("{timestamp}", LocalDateTime.now().toString())
                .replace("{workspace_name}", workspace.getName());
            ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
            masterNoteContent = model.generate(prompt);

        } else {
            // 复杂材料：走 Agent A 融合自检，失败时回退到单次 Prompt
            log.info("材料长度 {} ≥ 1500，启用 Agent A 融合自检，docId={}", newContent.length(), docId);
            try {
                masterNoteContent = mergeCheckAgent.mergeWithSelfCheck(
                    existingMaster, newContent, workspace.getName(), docId);
            } catch (Exception e) {
                // Agent A 失败时回退到单次 Prompt，不中断 Pipeline
                log.warn("Agent A 失败，回退到单次 Prompt：{}", e.getMessage());
                String promptTemplate = getDefaultPromptTemplate("organize_merge");
                String prompt = promptTemplate
                    .replace("{master_note}", existingMaster)
                    .replace("{new_content}", newContent)
                    .replace("{document_name}", doc.getFileName())
                    .replace("{timestamp}", LocalDateTime.now().toString())
                    .replace("{workspace_name}", workspace.getName());
                ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
                masterNoteContent = generateWithChunking(model, prompt, newContent);
            }
        }

        putCache(docId, "masterNoteContent", masterNoteContent);
        putCache(docId, "hasMasterNote", String.valueOf(hasMasterNote));
    }

    /**
     * 长文档分块处理策略。
     * < 12000 字符：直接单次 LLM 调用
     * ≥ 12000 字符：按 \n\n 段落分块（每块 ≤ 4000 字符），逐块整理后合并
     */
    private String generateWithChunking(ChatLanguageModel model, String prompt, String content) {
        if (content.length() < 12000) {
            return model.generate(prompt);
        }

        String[] paragraphs = content.split("\n\n");
        List<String> chunks = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String p : paragraphs) {
            if (current.length() + p.length() > 4000 && !current.isEmpty()) {
                chunks.add(current.toString());
                current = new StringBuilder();
            }
            current.append(p).append("\n\n");
        }
        if (!current.isEmpty()) chunks.add(current.toString());

        List<String> chunkResults = new ArrayList<>();
        for (String chunk : chunks) {
            String chunkPrompt = prompt.replace("{content}", chunk).replace("{new_content}", chunk);
            chunkResults.add(model.generate(chunkPrompt));
        }

        String mergePrompt = "将以下多份笔记合并为一份完整的知识笔记，消除重复，保留所有知识点：\n\n"
            + String.join("\n\n---\n\n", chunkResults);
        return model.generate(mergePrompt);
    }

    // ==================== Step 3：生成 Session Note ====================

    private void step3SessionNote(Long docId) {
        boolean autoSessionNote = Boolean.parseBoolean(
            systemConfigService.get("mindbank.pipeline.auto_session_note", "true"));
        if (!autoSessionNote) return;

        MindBankDocument doc = getDoc(docId);
        MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());
        String newContent = storagePort.readProcessed(doc.getProcessedMinioKey());
        String promptTemplate = getDefaultPromptTemplate("session_note");

        String prompt = promptTemplate
            .replace("{content}", newContent.substring(0, Math.min(3000, newContent.length())))
            .replace("{document_name}", doc.getFileName())
            .replace("{date}", LocalDate.now().toString())
            .replace("{workspace_name}", workspace.getName())
            .replace("{source_url}", buildMinioUrl(doc.getOriginalMinioKey()))
            .replace("{master_note_path}", workspace.getMasterNotePath() != null ? workspace.getMasterNotePath() : "待生成");

        ChatLanguageModel model = llmConfigService.resolveModel("mindbank_condense");
        String sessionNoteContent = model.generate(prompt);

        putCache(docId, "sessionNoteContent", sessionNoteContent);
    }

    // ==================== Step 4：写入 Obsidian vault ====================

    /**
     * Step 4：写入 Obsidian vault。
     * 通过 NotePort 操作，不直接操作文件系统——这是 Port 抽象层的价值所在。
     */
    private void step4WriteObsidian(Long docId) {
        MindBankDocument doc = getDoc(docId);
        MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());
        String subFolder = systemConfigService.get("notes.obsidian.sub_folder", "Mindbank");

        String folderClassifyPrompt = getDefaultPromptTemplate("classify_folder")
            .replace("{existing_folders}", getExistingFolders(subFolder))
            .replace("{workspace_name}", workspace.getName())
            .replace("{domain_tag}", workspace.getDomainTag() != null ? workspace.getDomainTag() : "")
            .replace("{summary}", getCacheOrEmpty(docId, "masterNoteContent")
                .substring(0, Math.min(200, getCacheOrEmpty(docId, "masterNoteContent").length())));
        ChatLanguageModel fastModel = llmConfigService.resolveModel("mindbank_classify");
        String suggestedFolder = fastModel.generate(folderClassifyPrompt).trim();

        String fullSubFolder = subFolder + "/" + suggestedFolder;

        String masterContent = getCache(docId, "masterNoteContent");
        notePort.writeMaster(workspace.getName(), fullSubFolder, masterContent);

        String sessionContent = getCacheOrEmpty(docId, "sessionNoteContent");
        String today = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        if (!sessionContent.isBlank()) {
            notePort.appendSession(workspace.getName(), fullSubFolder, sessionContent, today);
        }

        String indexEntry = String.format("- [%s](%s__master.md) — %s · %s",
            workspace.getName(),
            sanitizeFileName(workspace.getName()),
            doc.getFileName(), today);
        notePort.appendIndex(fullSubFolder, indexEntry);

        String vaultRoot = systemConfigService.get("notes.obsidian.vault_path");
        String safeName = sanitizeFileName(workspace.getName());
        String masterPath = vaultRoot + "/" + fullSubFolder + "/" + safeName + "__master.md";
        MindBankWorkspace wsUpdate = new MindBankWorkspace();
        wsUpdate.setId(workspace.getId());
        wsUpdate.setMasterNotePath(masterPath);
        workspaceMapper.updateById(wsUpdate);

        if (!sessionContent.isBlank()) {
            String sessionPath = vaultRoot + "/" + fullSubFolder + "/" + safeName + "__session__" + today + ".md";
            MindBankDocument docUpdate = new MindBankDocument();
            docUpdate.setId(docId);
            docUpdate.setSessionNotePath(sessionPath);
            documentMapper.updateById(docUpdate);
        }
    }

    // ==================== Step 5：更新 AnythingLLM Embedding ====================

    private void step5Embed(Long docId) {
        MindBankDocument doc = getDoc(docId);
        MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());

        if (workspace.getAnythingllmSlug() == null) {
            log.warn("Workspace {} 未配置 AnythingLLM slug，跳过 embedding", workspace.getId());
            return;
        }

        if (workspace.getAnythingllmDocId() != null) {
            try {
                knowledgeBasePort.deleteDocument(workspace.getAnythingllmSlug(), workspace.getAnythingllmDocId());
            } catch (Exception e) {
                log.warn("删除旧 embedding 失败，继续上传新版本：{}", e.getMessage());
            }
        }

        String masterContent = notePort.readMaster(workspace.getName());
        if (masterContent == null || masterContent.isBlank()) {
            log.warn("Master Note 内容为空，跳过 embedding");
            return;
        }

        String newDocId = knowledgeBasePort.uploadDocument(
            workspace.getAnythingllmSlug(), masterContent, workspace.getName() + "_master.md");

        MindBankWorkspace wsUpdate = new MindBankWorkspace();
        wsUpdate.setId(workspace.getId());
        wsUpdate.setAnythingllmDocId(newDocId);
        workspaceMapper.updateById(wsUpdate);
    }

    // ==================== 辅助方法 ====================

    private MindBankDocument getDoc(Long docId) {
        MindBankDocument doc = documentMapper.selectById(docId);
        if (doc == null) throw new IllegalArgumentException("文档不存在: id=" + docId);
        return doc;
    }

    private MindBankWorkspace getWorkspace(Long workspaceId) {
        MindBankWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) throw new IllegalArgumentException("Workspace 不存在: id=" + workspaceId);
        return workspace;
    }

    private void putCache(Long docId, String key, String value) {
        stepCache.computeIfAbsent(docId, k -> new ConcurrentHashMap<>()).put(key, value);
    }

    private String getCache(Long docId, String key) {
        Map<String, String> cache = stepCache.get(docId);
        if (cache == null) return null;
        return cache.get(key);
    }

    private String getCacheOrEmpty(Long docId, String key) {
        String val = getCache(docId, key);
        return val != null ? val : "";
    }

    /**
     * 获取指定类型的默认 Prompt 模板内容。
     * 优先取 is_default=true 的模板，无默认则取该类型第一个可用模板。
     */
    private String getDefaultPromptTemplate(String type) {
        MindBankPromptTemplate template = promptTemplateMapper.selectOne(
            new LambdaQueryWrapper<MindBankPromptTemplate>()
                .eq(MindBankPromptTemplate::getPromptType, type)
                .eq(MindBankPromptTemplate::getDefaultFlag, true)
                .last("LIMIT 1"));
        if (template == null) {
            template = promptTemplateMapper.selectOne(
                new LambdaQueryWrapper<MindBankPromptTemplate>()
                    .eq(MindBankPromptTemplate::getPromptType, type)
                    .last("LIMIT 1"));
        }
        if (template == null) {
            throw new IllegalStateException("未找到类型为 " + type + " 的 Prompt 模板，请在 Settings → Mindbank 中配置");
        }
        return template.getContent();
    }

    /** 构造 MinIO 文件完整 URL：{minio.url}/{bucket}/{key} */
    private String buildMinioUrl(String key) {
        if (key == null) return "";
        String minioUrl = systemConfigService.get("mindbank.minio.url", "");
        String bucket = systemConfigService.get("mindbank.minio.bucket", "mindbank");
        if (minioUrl.isBlank()) return key;
        return minioUrl + "/" + bucket + "/" + key;
    }

    private String sanitizeFileName(String name) {
        return name.replaceAll("[/\\\\:*?\"<>|]", "_");
    }

    /** 列举 vault subFolder 下第一层目录名，join 为逗号分隔 */
    private String getExistingFolders(String subFolder) {
        String vaultPath = systemConfigService.get("notes.obsidian.vault_path");
        if (vaultPath == null || vaultPath.isBlank()) return "";
        Path dir = Paths.get(vaultPath, subFolder);
        if (!Files.exists(dir) || !Files.isDirectory(dir)) return "";
        List<String> folders = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir, Files::isDirectory)) {
            for (Path entry : stream) {
                folders.add(entry.getFileName().toString());
            }
        } catch (IOException e) {
            log.warn("读取 vault 目录列表失败: {}", e.getMessage());
        }
        return String.join(", ", folders);
    }

    private void resetStepsFrom(Long documentId, int step) {
        MindBankDocument update = new MindBankDocument();
        update.setId(documentId);
        if (step <= 1) update.setStep1Status("pending");
        if (step <= 2) update.setStep2Status("pending");
        if (step <= 3) update.setStep3Status("pending");
        if (step <= 4) update.setStep4Status("pending");
        if (step <= 5) update.setStep5Status("pending");
        update.setStepErrorMsg(null);
        documentMapper.updateById(update);
    }

    private void updatePipelineStatus(Long docId, String status) {
        MindBankDocument update = new MindBankDocument();
        update.setId(docId);
        update.setPipelineStatus(status);
        documentMapper.updateById(update);
    }

    private void updateStepStatus(Long docId, int step, String status) {
        updateStepStatus(docId, step, status, null);
    }

    private void updateStepStatus(Long docId, int step, String status, String errorMsg) {
        MindBankDocument update = new MindBankDocument();
        update.setId(docId);
        switch (step) {
            case 1 -> update.setStep1Status(status);
            case 2 -> update.setStep2Status(status);
            case 3 -> update.setStep3Status(status);
            case 4 -> update.setStep4Status(status);
            case 5 -> update.setStep5Status(status);
        }
        if (errorMsg != null) {
            update.setStepErrorMsg(errorMsg);
        }
        documentMapper.updateById(update);
    }
}
