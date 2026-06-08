package com.nexus.controller;

import com.nexus.dto.request.PrismTranslateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.Translation;
import com.nexus.service.PrismService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/prism")
@RequiredArgsConstructor
public class PrismController {

    private final PrismService prismService;

    @PostMapping("/translate")
    public ApiResponse<Translation> translate(@Valid @RequestBody PrismTranslateRequest req) {
        return ApiResponse.ok(prismService.translate(req));
    }

    @GetMapping("/history")
    public ApiResponse<List<Translation>> history() {
        return ApiResponse.ok(prismService.history());
    }
}
