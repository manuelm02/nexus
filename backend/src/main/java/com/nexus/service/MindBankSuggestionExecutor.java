package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.nexus.config.SystemConfigKeys;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.CreateWorkspaceRequest;
import com.nexus.entity.MindBankAgentSuggestion;
import com.nexus.entity.MindBankDocument;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.mapper.MindBankDocumentMapper;
import com.nexus.mapper.MindBankWorkspaceMapper;
import com.nexus.port.KnowledgeBasePort;
import com.nexus.port.NotePort;
import com.nexus.port.StoragePort;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 执行用户采纳的巡检建议。
 * 每种 suggestion_type 对应一个确定性执行方法，通过 Port 接口完成所有操作。
 *
 * 安全原则：
 * - 所有操作通过 Port 接口，不直接操作文件系统（除 orphan_note 归档需文件移动）
 * - 不自动删除源 Workspace 或源笔记，只创建新资源或归档旧笔记
 * - LLM 调用失败时抛异常让 Controller 捕获，状态保持 pending 可重试
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankSuggestionExecutor {

    private final NotePort notePort;
    private final KnowledgeBasePort knowledgeBasePort;
    private final StoragePort storagePort;
    private final MindBankWorkspaceService workspaceService;
    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankDocumentMapper documentMapper;
    private final LlmConfigService llmConfigService;
    private final SystemConfigService systemConfigService;
    private final ObjectMapper objectMapper;

    /**
     * 根据建议类型分发执行。
     * @return 执行结果描述（展示在前端）
     */
    public String execute(MindBankAgentSuggestion suggestion) {
        String type = suggestion.getSuggestionType();
        log.info("执行巡检建议 id={} type={}", suggestion.getId(), type);

        return switch (type) {
            case "split_note" -> executeSplitNote(suggestion);
            case "merge_workspace" -> executeMergeWorkspace(suggestion);
            case "resplit_workspace" -> executeResplitWorkspace(suggestion);
            case "fix_index" -> executeFixIndex(suggestion);
            case "orphan_note" -> executeOrphanNote(suggestion);
            default -> throw new IllegalArgumentException("未知建议类型：" + type);
        };
    }

    // ==================== split_note：拆分过长 Master Note ====================

    /**
     * 拆分过长的 Master Note：用 LLM 按主题拆分，为每份创建新 Workspace + 笔记 + embedding。
     * 源 Workspace 保留不删除，用户确认后手动删除。
     */
    private String executeSplitNote(MindBankAgentSuggestion suggestion) {
        String sourceWorkspaceName = getAffectedWorkspaceName(suggestion, 0);

        // 读取源 Master Note
        String masterContent = notePort.readMaster(sourceWorkspaceName);
        if (masterContent == null || masterContent.isBlank()) {
            return "源 Workspace「" + sourceWorkspaceName + "」无 Master Note，跳过";
        }

        // 用 LLM 拆分内容
        ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
        if (model == null) throw new IllegalStateException("请先配置 mindbank_organize 模型");

        String splitPrompt = """
            将以下知识笔记按主题拆分为多份独立的知识笔记。
            每份应围绕一个独立的主题，内容完整可独立阅读。

            输出 JSON 格式：
            [
              {"title": "主题名称", "content": "完整笔记内容（Markdown）"},
              ...
            ]

            原始笔记：

            """ + masterContent;

        String splitResult = model.generate(splitPrompt);

        // 解析 JSON（容错 markdown 代码块包裹）
        List<Map<String, String>> parts = parseSplitResult(splitResult);
        if (parts.isEmpty() || parts.size() < 2) {
            return "LLM 未能将笔记拆分为多个主题，请检查笔记内容或手动拆分";
        }

        // 为每份创建新 Workspace + 写笔记 + embedding
        String subFolder = systemConfigService.get(SystemConfigKeys.MINDBANK_OBSIDIAN_SUB_FOLDER, "Mindbank");
        List<String> createdNames = new ArrayList<>();

        for (Map<String, String> part : parts) {
            String newName = part.get("title");
            String newContent = part.get("content");

            try {
                CreateWorkspaceRequest req = new CreateWorkspaceRequest();
                req.setName(newName);
                req.setDomainTag(getSourceDomainTag(sourceWorkspaceName));
                req.setDescription("从「" + sourceWorkspaceName + "」拆分");
                MindBankWorkspace newWorkspace = workspaceService.create(req);

                // 写 Master Note
                notePort.writeMaster(newName, subFolder, newContent);

                // 更新 DB 中的 Master Note 路径
                String vaultRoot = systemConfigService.get("notes.obsidian.vault_path");
                String safeName = sanitizeFileName(newName);
                newWorkspace.setMasterNotePath(vaultRoot + "/" + subFolder + "/" + safeName + "__master.md");
                workspaceMapper.updateById(newWorkspace);

                // 创建 embedding
                if (newWorkspace.getAnythingllmSlug() != null) {
                    try {
                        String docId = knowledgeBasePort.uploadDocument(
                            newWorkspace.getAnythingllmSlug(), newContent, newName + "_master.md");
                        newWorkspace.setAnythingllmDocId(docId);
                        workspaceMapper.updateById(newWorkspace);
                    } catch (Exception e) {
                        log.warn("新 Workspace「{}」embedding 创建失败：{}", newName, e.getMessage());
                    }
                }

                createdNames.add(newName);
            } catch (Exception e) {
                log.error("拆分创建 Workspace「{}」失败：{}", newName, e.getMessage());
            }
        }

        if (createdNames.isEmpty()) {
            throw new RuntimeException("所有拆分子项创建失败");
        }

        return String.format("已从「%s」拆分为 %d 个新 Workspace：%s。源 Workspace 保留，请确认无误后手动删除。",
            sourceWorkspaceName, createdNames.size(), String.join("、", createdNames));
    }

    // ==================== merge_workspace：合并重叠 Workspace ====================

    /**
     * 合并内容重叠的 Workspace：用 LLM 合并多份 Master Note，迁移文档记录。
     * 源 Workspace 保留不删除。
     */
    private String executeMergeWorkspace(MindBankAgentSuggestion suggestion) {
        List<String> workspaceNames = parseAffectedNotes(suggestion);
        if (workspaceNames.size() < 2) {
            return "合并至少需要 2 个 Workspace";
        }

        // 读取所有 Master Note
        Map<String, String> masterNotes = new LinkedHashMap<>();
        for (String name : workspaceNames) {
            String content = notePort.readMaster(name);
            if (content != null && !content.isBlank()) {
                masterNotes.put(name, content);
            }
        }

        if (masterNotes.isEmpty()) {
            return "所有待合并 Workspace 均无 Master Note";
        }

        // 用 LLM 合并
        ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
        StringBuilder mergeInput = new StringBuilder();
        for (var entry : masterNotes.entrySet()) {
            mergeInput.append("## 来自「").append(entry.getKey()).append("」\n\n")
                .append(entry.getValue()).append("\n\n---\n\n");
        }

        String mergePrompt = """
            将以下多份知识笔记合并为一份完整的知识笔记。
            要求：消除重复内容，保留所有独特的知识点，章节结构清晰连贯。

            """ + mergeInput;

        String mergedContent = model.generate(mergePrompt);

        // 确定目标 Workspace（优先 proposed_action 中的 targetName，否则用第一个）
        String targetName = workspaceNames.get(0);
        Map<String, Object> action = parseProposedAction(suggestion);
        if (action.containsKey("targetName")) {
            targetName = (String) action.get("targetName");
        }

        // 写入合并后 Master Note
        String subFolder = systemConfigService.get(SystemConfigKeys.MINDBANK_OBSIDIAN_SUB_FOLDER, "Mindbank");
        notePort.writeMaster(targetName, subFolder, mergedContent);

        // 更新目标 Workspace 的 masterNotePath 和 embedding
        MindBankWorkspace targetWorkspace = findWorkspaceByName(targetName);
        if (targetWorkspace != null) {
            String vaultRoot = systemConfigService.get("notes.obsidian.vault_path");
            String safeName = sanitizeFileName(targetName);
            targetWorkspace.setMasterNotePath(vaultRoot + "/" + subFolder + "/" + safeName + "__master.md");
            workspaceMapper.updateById(targetWorkspace);

            // 更新 embedding：先删旧再上传新
            if (targetWorkspace.getAnythingllmSlug() != null) {
                try {
                    if (targetWorkspace.getAnythingllmDocId() != null) {
                        knowledgeBasePort.deleteDocument(targetWorkspace.getAnythingllmSlug(),
                            targetWorkspace.getAnythingllmDocId());
                    }
                    String docId = knowledgeBasePort.uploadDocument(
                        targetWorkspace.getAnythingllmSlug(), mergedContent, targetName + "_master.md");
                    targetWorkspace.setAnythingllmDocId(docId);
                    workspaceMapper.updateById(targetWorkspace);
                } catch (Exception e) {
                    log.warn("合并后 embedding 更新失败：{}", e.getMessage());
                }
            }

            // 迁移其他 Workspace 的文档记录到目标
            for (String name : workspaceNames) {
                if (!name.equals(targetName)) {
                    MindBankWorkspace source = findWorkspaceByName(name);
                    if (source != null) {
                        documentMapper.update(null,
                            new LambdaUpdateWrapper<MindBankDocument>()
                                .eq(MindBankDocument::getWorkspaceId, source.getId())
                                .set(MindBankDocument::getWorkspaceId, targetWorkspace.getId()));
                    }
                }
            }
        }

        return String.format("已将 %s 合并至「%s」。源 Workspace 保留，请确认无误后手动删除其他 Workspace。",
            String.join("、", workspaceNames), targetName);
    }

    // ==================== fix_index：修正知识索引 ====================

    /**
     * 修正 _index.md：移除指向不存在文件的条目，补充未被索引的 Master Note。
     */
    private String executeFixIndex(MindBankAgentSuggestion suggestion) {
        String subFolder = systemConfigService.get(SystemConfigKeys.MINDBANK_OBSIDIAN_SUB_FOLDER, "Mindbank");

        // 读取现有索引
        String currentIndex = notePort.readIndex(subFolder);
        if (currentIndex == null || currentIndex.isBlank()) {
            return "索文件不存在或为空，跳过修正";
        }

        // 获取实际存在的 Master Note 文件列表
        List<NotePort.NoteMeta> allNotes = notePort.listNotes();
        Set<String> existingMasterPaths = new HashSet<>();
        for (NotePort.NoteMeta note : allNotes) {
            if (note.name().endsWith("__master.md")) {
                existingMasterPaths.add(note.path());
            }
        }

        // 解析索引中的条目，移除无效的
        String[] lines = currentIndex.split("\n");
        List<String> validLines = new ArrayList<>();
        int removedCount = 0;

        for (String line : lines) {
            if (line.startsWith("- [") && line.contains("](")) {
                int start = line.indexOf("](") + 2;
                int end = line.indexOf(")", start);
                if (end > start) {
                    String path = line.substring(start, end);
                    // 宽松匹配：索引中可能是相对路径，实际文件是完整路径
                    boolean exists = existingMasterPaths.stream()
                        .anyMatch(p -> p.contains(path) || p.endsWith(path));
                    if (!exists) {
                        removedCount++;
                        continue;
                    }
                }
            }
            validLines.add(line);
        }

        // 补充未索引的 Master Note
        int addedCount = 0;
        Set<String> indexedPaths = new HashSet<>();
        for (String line : validLines) {
            if (line.contains("](")) {
                int start = line.indexOf("](") + 2;
                int end = line.indexOf(")", start);
                if (end > start) indexedPaths.add(line.substring(start, end));
            }
        }

        for (String masterPath : existingMasterPaths) {
            boolean isIndexed = indexedPaths.stream().anyMatch(masterPath::contains);
            if (!isIndexed) {
                String fileName = Path.of(masterPath).getFileName().toString();
                String workspaceName = fileName.replace("__master.md", "").replace("_", " ");
                validLines.add(String.format("- [%s](%s) — 自动补充", workspaceName, masterPath));
                addedCount++;
            }
        }

        // 覆盖写入修正后的索引
        String newIndex = String.join("\n", validLines);
        notePort.writeIndex(subFolder, newIndex);

        return String.format("索引修正完成：移除 %d 个无效条目，补充 %d 个新条目", removedCount, addedCount);
    }

    // ==================== orphan_note：处理孤立笔记 ====================

    /**
     * 处理孤立笔记：通过 NotePort 归档到 _archive 目录。
     * 不自动删除，只移动到归档目录。文件名冲突时追加数字后缀。
     */
    private String executeOrphanNote(MindBankAgentSuggestion suggestion) {
        List<String> notePaths = parseAffectedNotes(suggestion);

        int archivedCount = 0;
        for (String notePath : notePaths) {
            try {
                notePort.archiveNote(notePath, "_archive");
                archivedCount++;
            } catch (Exception e) {
                log.error("归档笔记失败 {}：{}", notePath, e.getMessage());
            }
        }

        return String.format("已归档 %d 篇孤立笔记至 _archive 目录", archivedCount);
    }

    // ==================== resplit_workspace：重新切分 ====================

    /**
     * 重新切分内容过杂的 Workspace，逻辑与 split_note 完全一致。
     */
    private String executeResplitWorkspace(MindBankAgentSuggestion suggestion) {
        return executeSplitNote(suggestion);
    }

    // ==================== 辅助方法 ====================

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseProposedAction(MindBankAgentSuggestion suggestion) {
        try {
            return objectMapper.readValue(suggestion.getProposedAction(), Map.class);
        } catch (Exception e) {
            log.warn("解析 proposedAction 失败：{}", e.getMessage());
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> parseAffectedNotes(MindBankAgentSuggestion suggestion) {
        try {
            return objectMapper.readValue(suggestion.getAffectedNotes(), List.class);
        } catch (Exception e) {
            log.warn("解析 affectedNotes 失败：{}", e.getMessage());
            return List.of();
        }
    }

    private String getAffectedWorkspaceName(MindBankAgentSuggestion suggestion, int index) {
        List<String> affected = parseAffectedNotes(suggestion);
        return index < affected.size() ? affected.get(index) : "";
    }

    private String getSourceDomainTag(String workspaceName) {
        MindBankWorkspace ws = findWorkspaceByName(workspaceName);
        return ws != null ? ws.getDomainTag() : null;
    }

    private MindBankWorkspace findWorkspaceByName(String name) {
        return workspaceMapper.selectOne(
            new LambdaQueryWrapper<MindBankWorkspace>()
                .eq(MindBankWorkspace::getName, name));
    }

    /**
     * 解析 LLM 拆分输出为 title→content 映射列表。
     * 容错处理：LLM 输出可能被 markdown ```json 代码块包裹。
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, String>> parseSplitResult(String llmOutput) {
        try {
            String json = llmOutput;
            // 容错：提取 JSON 数组部分（即使被 markdown 代码块包裹）
            int start = json.indexOf('[');
            int end = json.lastIndexOf(']');
            if (start >= 0 && end > start) {
                json = json.substring(start, end + 1);
            }
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("解析拆分结果失败：{}", e.getMessage());
            return List.of();
        }
    }

    /** 文件名清理：替换文件系统保留字符 */
    private String sanitizeFileName(String name) {
        return name.replaceAll("[/\\\\:*?\"<>|]", "_");
    }
}
