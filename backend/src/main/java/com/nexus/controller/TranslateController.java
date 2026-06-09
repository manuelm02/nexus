package com.nexus.controller;

import com.nexus.dto.request.TranslateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.Translation;
import com.nexus.service.TranslateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Translate 翻译接口，保留 /prism 旧路径用于兼容已有客户端。 */
@RestController
@RequestMapping({"/api/v1/translate", "/api/v1/prism"})
@RequiredArgsConstructor
public class TranslateController {

    private final TranslateService translateService;

    @PostMapping("/translate")
    public ApiResponse<Translation> translate(@Valid @RequestBody TranslateRequest req) {
        return ApiResponse.ok(translateService.translate(req));
    }

    @GetMapping("/history")
    public ApiResponse<List<Translation>> history() {
        return ApiResponse.ok(translateService.history());
    }
}
