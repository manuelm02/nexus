package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.MindBankDocument;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.mapper.MindBankDocumentMapper;
import com.nexus.mapper.MindBankWorkspaceMapper;
import com.nexus.port.KnowledgeBaseAnswer;
import com.nexus.port.KnowledgeBasePort;
import com.nexus.port.NotePort;
import com.nexus.port.StoragePort;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Agent 的"手脚"：将 Port 方法包装为 LangChain4j @Tool，供 Agent loop 调用。
 * Agent 能做的事 = Port 能力的子集 + 组合。这就是 Phase 6-4 抽 Port 的价值——
 * Pipeline 和 Agent 不重复造轮子，Agent 工具只是 Port 方法的薄包装。
 *
 * 所有方法均为只读操作，Agent B 巡检不修改任何数据。
 * 返回值统一格式化为文本（而非原始对象），便于 LLM 理解和推理。
 */
@Component
@RequiredArgsConstructor
public class MindBankAgentTools {

    private final NotePort notePort;
    private final KnowledgeBasePort knowledgeBasePort;
    private final StoragePort storagePort;
    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankDocumentMapper documentMapper;
    private final SystemConfigService systemConfigService;

    @Tool("列出 Obsidian vault 中所有笔记的元信息（文件名、路径、文件大小字节数、最后修改时间），用于发现过大或长期未更新的笔记")
    public String listAllNotes() {
        List<NotePort.NoteMeta> notes = notePort.listNotes();
        if (notes.isEmpty()) {
            return "Vault 中暂无笔记文件";
        }
        return notes.stream()
            .map(n -> String.format("%s | %s | %d bytes | %s",
                n.name(), n.path(), n.sizeBytes(), n.lastModified()))
            .collect(Collectors.joining("\n"));
    }

    @Tool("读取指定 Workspace 的 Master Note 全文。参数：workspaceName（Workspace 名称）")
    public String readMasterNote(@P("Workspace 名称") String workspaceName) {
        String content = notePort.readMaster(workspaceName);
        if (content == null) {
            return "该 Workspace 尚未生成 Master Note";
        }
        // 截断防止上下文溢出（保留前 8000 字符）
        return content.length() > 8000
            ? content.substring(0, 8000) + "\n\n[... 内容过长已截断 ...]"
            : content;
    }

    @Tool("读取知识库全局索引（_index.md），查看所有已整理的知识条目和结构")
    public String readIndex() {
        String subFolder = systemConfigService.get("notes.obsidian.sub_folder", "Mindbank");
        String index = notePort.readIndex(subFolder);
        return index.isBlank() ? "全局索引为空，尚无已整理的知识条目" : index;
    }

    @Tool("列出所有 Workspace 的基本信息（名称、领域标签、文档数量、是否有 Master Note），用于识别重叠或需要合并/拆分的 Workspace")
    public String listWorkspaces() {
        List<MindBankWorkspace> workspaces = workspaceMapper.selectList(null);
        if (workspaces.isEmpty()) {
            return "暂无 Workspace";
        }
        return workspaces.stream()
            .map(w -> String.format("- %s [%s] | 文档数: %d | Master Note: %s",
                w.getName(),
                w.getDomainTag() != null ? w.getDomainTag() : "无标签",
                getDocCount(w.getId()),
                w.getMasterNotePath() != null ? "有" : "无"))
            .collect(Collectors.joining("\n"));
    }

    @Tool("在指定 Workspace 的知识库中搜索内容，用于判断两个 Workspace 之间的内容重叠度。参数：workspaceSlug（AnythingLLM slug）, query（搜索关键词或问题）")
    public String searchKnowledgeBase(
            @P("AnythingLLM workspace slug") String workspaceSlug,
            @P("搜索关键词或问题") String query) {
        try {
            KnowledgeBaseAnswer result = knowledgeBasePort.query(workspaceSlug, query);
            return result.answer() != null ? result.answer() : "未找到相关内容";
        } catch (Exception e) {
            return "搜索失败：" + e.getMessage();
        }
    }

    @Tool("读取 MinIO 中指定文件的处理后内容（Markdown），用于追溯原始材料求证。参数：key（processedMinioKey）")
    public String readProcessedFile(@P("MinIO 文件 key（processedMinioKey）") String key) {
        try {
            String content = storagePort.readProcessed(key);
            // 截断防止上下文溢出
            return content.length() > 5000
                ? content.substring(0, 5000) + "\n\n[... 内容过长已截断 ...]"
                : content;
        } catch (Exception e) {
            return "读取失败：" + e.getMessage();
        }
    }

    @Tool("列出指定 Workspace 下的所有文档信息（文件名、来源类型、创建时间），了解知识库收录了哪些材料。参数：workspaceId")
    public String listDocuments(@P("Workspace ID") Long workspaceId) {
        List<MindBankDocument> docs = documentMapper.selectList(
            new LambdaQueryWrapper<MindBankDocument>()
                .eq(MindBankDocument::getWorkspaceId, workspaceId)
                .orderByDesc(MindBankDocument::getCreatedAt));
        if (docs.isEmpty()) {
            return "该 Workspace 暂无文档";
        }
        return docs.stream()
            .map(d -> String.format("- %s [%s] %s",
                d.getFileName(),
                d.getSourceType(),
                d.getCreatedAt() != null ? d.getCreatedAt().toLocalDate() : "未知日期"))
            .collect(Collectors.joining("\n"));
    }

    /** 统计指定 Workspace 挂载的文档数量 */
    private long getDocCount(Long workspaceId) {
        return documentMapper.selectCount(
            new LambdaQueryWrapper<MindBankDocument>()
                .eq(MindBankDocument::getWorkspaceId, workspaceId));
    }
}
