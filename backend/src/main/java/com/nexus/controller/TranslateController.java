package com.nexus.controller;

import com.nexus.dto.request.TranslateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.HistoryPageResponse;
import com.nexus.entity.Translation;
import com.nexus.service.TranslateStreamingService;
import com.nexus.service.TranslateService;
import com.nexus.translate.TranslationResultPayload;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;

/** Translate 翻译接口，保留 /prism 旧路径用于兼容已有客户端。 */
@RestController
@RequestMapping({"/api/v1/translate", "/api/v1/prism"})
@RequiredArgsConstructor
public class TranslateController {

    private final TranslateService translateService;
    private final TranslateStreamingService translateStreamingService;
    private final ObjectMapper objectMapper;

    @PostMapping("/translate")
    public ResponseEntity<ApiResponse<Translation>> translate(@Valid @RequestBody TranslateRequest req) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(translateService.translate(req)));
        } catch (IllegalStateException e) {
            if (e.getMessage() != null && e.getMessage().contains("Provider")) {
                return ResponseEntity.badRequest().body(ApiResponse.error("TRANSLATION_PROVIDER_NOT_CONFIGURED", e.getMessage()));
            }
            throw e;
        }
    }

    /**
     * 分页查询翻译历史。
     *
     * @param page 页码，从 1 开始，默认 1
     * @param size 每页条数，默认 12
     */
    @GetMapping("/history")
    public ApiResponse<HistoryPageResponse<Translation>> history(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ApiResponse.ok(translateService.history(page, size));
    }

    /** 删除单条翻译记录。 */
    @DeleteMapping("/history/{id}")
    public ApiResponse<Void> deleteHistory(@PathVariable String id) {
        translateService.deleteHistory(id);
        return ApiResponse.ok();
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public StreamingResponseBody stream(@Valid @RequestBody TranslateRequest req, HttpServletResponse response) throws IOException {
        // 禁用 Servlet 响应缓冲 + 强制提交响应头，确保每个 SSE 事件实时送达前端。
        response.setBufferSize(0);
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-cache");
        response.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        response.flushBuffer();

        return outputStream -> {
            final TranslationResultPayload[] finalPayload = new TranslationResultPayload[1];
            translateStreamingService.translateStreaming(req, event -> {
                try {
                    // token 事件载荷仅含 translatedText，序列化后一样走 SSE
                    if (!"token".equals(event.type())) finalPayload[0] = event.payload();
                    writeSse(outputStream, event.type(), objectMapper.writeValueAsString(event.payload()));
                } catch (IOException e) {
                    throw new IllegalStateException("翻译流写出失败", e);
                }
            });
            // 以最后一个 enhanced/done 事件的 payload 作为持久化数据
            if (finalPayload[0] != null) translateService.persist(req, finalPayload[0]);
        };
    }

    private void writeSse(java.io.OutputStream outputStream, String event, String data) throws IOException {
        outputStream.write(("event:" + event + "\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        outputStream.write(("data:" + data + "\n\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        outputStream.flush();
    }
}
