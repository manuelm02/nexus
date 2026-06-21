package com.nexus.controller;

import com.nexus.dto.request.MindBankSettingsUpdateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.MindBankSettingsResponse;
import com.nexus.service.MindBankSettingsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

/**
 * Mindbank 配置管理接口，挂载在 /api/v1/settings/mindbank 下。
 * 复用 SettingsController 的路径前缀，独立 Controller 避免 SettingsController 膨胀。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/settings/mindbank")
@RequiredArgsConstructor
public class MindBankSettingsController {

    private final MindBankSettingsService mindBankSettingsService;

    /** 获取所有 Mindbank 配置，API Key 类字段返回脱敏标记 */
    @GetMapping
    public ApiResponse<MindBankSettingsResponse> getSettings() {
        return ApiResponse.ok(mindBankSettingsService.getSettings());
    }

    /** PATCH 语义更新 Mindbank 配置，Key 类字段加密后存储 */
    @PutMapping
    public ApiResponse<MindBankSettingsResponse> updateSettings(@RequestBody MindBankSettingsUpdateRequest req) {
        return ApiResponse.ok(mindBankSettingsService.updateSettings(req));
    }
}
