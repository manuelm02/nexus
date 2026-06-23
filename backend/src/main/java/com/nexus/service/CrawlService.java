package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.response.CrawlResultResponse;
import com.nexus.entity.MindBankDocument;
import com.nexus.integration.crawl4ai.Crawl4AiClient;
import com.nexus.integration.crawl4ai.Crawl4AiResult;
import com.nexus.integration.markitdown.MarkItDownClient;
import com.nexus.integration.minio.MinioService;
import com.nexus.mapper.MindBankDocumentMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * CrawlService 编排网页爬取、文件上传转换、MinIO 存储和文档入库的全流程。
 * 网页爬取：Crawl4AiClient 异步提交 + 同步轮询（最长 60s），结果上传 MinIO。
 * 文件上传：MarkItDownClient 转换为 Markdown，原始文件和 Markdown 分别上传 MinIO。
 * 两者均创建 MindBankDocument 记录（workspace_id=null），等待用户导入到 Workspace。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CrawlService {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final int POLL_MAX_SECONDS = 60;
    private static final int POLL_INTERVAL_MS = 3000;
    private static final int PREVIEW_LENGTH = 500;

    private final Crawl4AiClient crawl4AiClient;
    private final MarkItDownClient markItDownClient;
    private final MinioService minioService;
    private final MindBankDocumentMapper mindBankDocumentMapper;
    private final SystemConfigService systemConfigService;
    private final MindBankPipelineService mindBankPipelineService;

    /**
     * 爬取网页：提交 Crawl4AI 任务 → 轮询直到完成 → 上传 MinIO → 入库。
     * 同步阻塞等待结果（最长 60s），因为 HTTP 请求需要返回 Markdown 预览给前端。
     *
     * @param url 目标网页 URL
     * @return 包含 docId 和 markdown 预览的结果
     */
    public CrawlResultResponse crawlWeb(String url) {
        // 1. 提交异步爬取任务
        String taskId = crawl4AiClient.submitCrawl(url);
        log.info("Crawl4AI 任务已提交: url={}, taskId={}", url, taskId);

        // 2. 同步轮询直到完成或超时
        Crawl4AiResult result = pollUntilDone(taskId);
        if (result.isFailed() || result.markdownContent() == null) {
            throw new RuntimeException("网页爬取失败: " + (result.errorMsg() != null ? result.errorMsg() : "未返回内容"));
        }

        // 3. 上传到 MinIO
        String bucket = getBucket();
        String month = LocalDate.now().format(MONTH_FMT);
        String uuid = UUID.randomUUID().toString();
        String originalKey = "originals/" + month + "/" + uuid + ".html";
        String processedKey = "processed/" + month + "/" + uuid + ".md";

        // 原始 HTML 可能为空（部分页面 Crawl4AI 不返回），为空时跳过上传
        if (result.rawHtml() != null && !result.rawHtml().isBlank()) {
            minioService.uploadText(bucket, originalKey, result.rawHtml());
        }
        minioService.uploadText(bucket, processedKey, result.markdownContent());

        // 4. 入库
        MindBankDocument doc = new MindBankDocument();
        doc.setFileName(extractFileName(url));
        doc.setSourceType("crawl_web");
        doc.setOriginalMinioKey(originalKey);
        doc.setProcessedMinioKey(processedKey);
        doc.setPipelineStatus("pending");
        resetStepStatuses(doc);
        mindBankDocumentMapper.insert(doc);

        // 5. 返回结果
        CrawlResultResponse resp = new CrawlResultResponse();
        resp.setDocId(doc.getId());
        resp.setProcessedMinioKey(processedKey);
        resp.setMarkdownPreview(truncate(result.markdownContent(), PREVIEW_LENGTH));
        return resp;
    }

    /**
     * 上传文件：原始文件存 MinIO → MarkItDown 转 Markdown → Markdown 存 MinIO → 入库。
     *
     * @param file 用户上传的文件
     * @return 包含 docId 和 markdown 预览的结果
     */
    public CrawlResultResponse uploadFile(MultipartFile file) {
        String bucket = getBucket();
        String month = LocalDate.now().format(MONTH_FMT);
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "unnamed";
        String uuid = UUID.randomUUID().toString();

        // 1. 原始文件上传 MinIO（保留原始扩展名）
        String originalKey = "originals/" + month + "/" + uuid + "_" + sanitizeFilename(originalFilename);
        try {
            minioService.uploadStream(bucket, originalKey, file.getInputStream(),
                    file.getSize(), file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        } catch (Exception e) {
            throw new RuntimeException("原始文件上传 MinIO 失败", e);
        }

        // 2. MarkItDown 转换为 Markdown
        String markdown = markItDownClient.convert(file);

        // 3. Markdown 上传 MinIO
        String processedKey = "processed/" + month + "/" + uuid + "_" + replaceExtension(originalFilename, ".md");
        minioService.uploadText(bucket, processedKey, markdown);

        // 4. 入库
        MindBankDocument doc = new MindBankDocument();
        doc.setFileName(originalFilename);
        doc.setSourceType("crawl_file");
        doc.setOriginalMinioKey(originalKey);
        doc.setProcessedMinioKey(processedKey);
        doc.setPipelineStatus("pending");
        resetStepStatuses(doc);
        mindBankDocumentMapper.insert(doc);

        // 5. 返回结果
        CrawlResultResponse resp = new CrawlResultResponse();
        resp.setDocId(doc.getId());
        resp.setProcessedMinioKey(processedKey);
        resp.setMarkdownPreview(truncate(markdown, PREVIEW_LENGTH));
        return resp;
    }

    /** 查询所有未导入到 Workspace 的文档（workspace_id IS NULL） */
    public List<MindBankDocument> listUnassignedFiles() {
        return mindBankDocumentMapper.selectList(
                new LambdaQueryWrapper<MindBankDocument>()
                        .isNull(MindBankDocument::getWorkspaceId)
                        .orderByDesc(MindBankDocument::getCreatedAt));
    }

    /**
     * 删除文件：删除 MinIO 原始和 processed 文件 + 删除 DB 记录。
     * MinIO 删除失败不阻断 DB 删除（文件可能已被手动删除）。
     */
    public void deleteFile(Long docId) {
        MindBankDocument doc = mindBankDocumentMapper.selectById(docId);
        if (doc == null) {
            throw new IllegalArgumentException("文档不存在: " + docId);
        }
        String bucket = getBucket();
        // MinIO 删除容错：单个文件删除失败不阻止整体删除
        tryDeleteMinio(bucket, doc.getOriginalMinioKey());
        tryDeleteMinio(bucket, doc.getProcessedMinioKey());
        mindBankDocumentMapper.deleteById(docId);
    }

    /**
     * 导入文件到 Workspace：更新 workspace_id 和可选 Prompt 模板，触发 Pipeline 异步处理。
     *
     * @param docId Crawl 文件对应的文档 ID
     * @param workspaceId 目标 Mindbank Workspace ID
     * @param promptTemplateId 可选 Step 2 整理模板 ID，空值时 Pipeline 使用默认模板
     */
    public void importToWorkspace(Long docId, Long workspaceId, Long promptTemplateId) {
        MindBankDocument doc = mindBankDocumentMapper.selectById(docId);
        if (doc == null) {
            throw new IllegalArgumentException("文档不存在: " + docId);
        }
        doc.setWorkspaceId(workspaceId);
        doc.setPromptTemplateId(promptTemplateId);
        doc.setPipelineStatus("processing");
        mindBankDocumentMapper.updateById(doc);
        mindBankPipelineService.triggerAsync(docId);
        log.info("文档 {} 已导入到 workspace {}，Pipeline 异步触发", docId, workspaceId);
    }

    // === 内部工具方法 ===

    /** 同步轮询 Crawl4AI 任务直到 completed/failed 或超时 */
    private Crawl4AiResult pollUntilDone(String taskId) {
        long deadline = System.currentTimeMillis() + POLL_MAX_SECONDS * 1000L;
        while (System.currentTimeMillis() < deadline) {
            Crawl4AiResult result = crawl4AiClient.getResult(taskId);
            if (result.isCompleted() || result.isFailed()) {
                return result;
            }
            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("爬取轮询被中断", e);
            }
        }
        return new Crawl4AiResult("failed", null, null, "爬取超时（" + POLL_MAX_SECONDS + "s）");
    }

    /** 读取 MinIO bucket 配置 */
    private String getBucket() {
        return systemConfigService.get("mindbank.minio.bucket", "mindbank");
    }

    /** 初始化 5 步状态为 pending */
    private void resetStepStatuses(MindBankDocument doc) {
        doc.setStep1Status("pending");
        doc.setStep2Status("pending");
        doc.setStep3Status("pending");
        doc.setStep4Status("pending");
        doc.setStep5Status("pending");
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return null;
        return text.length() > maxLen ? text.substring(0, maxLen) + "..." : text;
    }

    private String extractFileName(String url) {
        String clean = url.replaceAll("^https?://", "").replaceAll("[/\\?#].*$", "");
        return clean;
    }

    private String sanitizeFilename(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String replaceExtension(String filename, String newExt) {
        int dotIdx = filename.lastIndexOf('.');
        return (dotIdx > 0 ? filename.substring(0, dotIdx) : filename) + newExt;
    }

    private void tryDeleteMinio(String bucket, String key) {
        if (key == null || key.isBlank()) return;
        try {
            minioService.deleteFile(bucket, key);
        } catch (Exception e) {
            log.warn("MinIO 删除失败（忽略）: key={}, err={}", key, e.getMessage());
        }
    }
}
