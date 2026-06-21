package com.nexus.controller;

import com.nexus.dto.request.ImportToMindbankRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.CrawlResultResponse;
import com.nexus.entity.MindBankDocument;
import com.nexus.service.CrawlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * CrawlController 提供网页爬取、文件上传转换、MinIO 文件管理和导入 Mindbank 的接口。
 * 所有接口返回统一 ApiResponse 格式，路径前缀 /api/v1/crawl。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/crawl")
@RequiredArgsConstructor
public class CrawlController {

    private final CrawlService crawlService;

    /**
     * 爬取网页：同步等待 Crawl4AI 结果，返回 Markdown 预览。
     * 响应时间较长（最长 60s 轮询），前端需设置足够的 timeout。
     */
    @PostMapping("/web")
    public ApiResponse<CrawlResultResponse> crawlWeb(@RequestParam String url) {
        return ApiResponse.ok(crawlService.crawlWeb(url));
    }

    /**
     * 上传文件：通过 MarkItDown 转换为 Markdown，返回预览。
     * 使用 multipart/form-data，file 参数为上传的文件。
     */
    @PostMapping("/file")
    public ApiResponse<CrawlResultResponse> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ApiResponse.error("VALIDATION_ERROR", "文件不能为空");
        }
        return ApiResponse.ok(crawlService.uploadFile(file));
    }

    /** 查询所有未导入到 Workspace 的文件列表 */
    @GetMapping("/files")
    public ApiResponse<List<MindBankDocument>> listFiles() {
        return ApiResponse.ok(crawlService.listUnassignedFiles());
    }

    /** 删除文件（MinIO + DB） */
    @DeleteMapping("/files/{docId}")
    public ApiResponse<Void> deleteFile(@PathVariable Long docId) {
        crawlService.deleteFile(docId);
        return ApiResponse.ok();
    }

    /** 导入文件到 Mindbank Workspace，触发 Pipeline 异步处理 */
    @PostMapping("/import")
    public ApiResponse<Void> importToMindbank(@RequestBody ImportToMindbankRequest req) {
        crawlService.importToWorkspace(req.getDocId(), req.getWorkspaceId());
        return ApiResponse.ok();
    }
}
