package com.nexus.controller;

import com.nexus.dto.request.LlmProviderCreateRequest;
import com.nexus.dto.request.LlmProviderUpdateRequest;
import com.nexus.dto.request.SystemConfigUpdateRequest;
import com.nexus.dto.request.WorkflowLlmConfigRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.LlmProvider;
import com.nexus.entity.WorkflowLlmConfig;
import com.nexus.service.LlmConfigService;
import com.nexus.service.SystemConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** SettingsController 提供 LLM 和系统配置的管理接口。 */
@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final LlmConfigService llmConfigService;
    private final SystemConfigService systemConfigService;

    @GetMapping("/llm/providers")
    public ApiResponse<List<LlmProvider>> listProviders() {
        return ApiResponse.ok(llmConfigService.listProviders());
    }

    @PostMapping("/llm/providers")
    public ApiResponse<LlmProvider> createProvider(@Valid @RequestBody LlmProviderCreateRequest req) {
        LlmProvider provider = new LlmProvider();
        provider.setName(req.getName());
        provider.setProvider(req.getProvider());
        provider.setApiKey(req.getApiKey() != null ? llmConfigService.encrypt(req.getApiKey()) : null);
        provider.setBaseUrl(req.getBaseUrl());
        provider.setModel(req.getModel());
        provider.setDefaultProvider(req.isDefault());
        provider.setEnabled(req.isEnabled());
        return ApiResponse.ok(llmConfigService.createProvider(provider));
    }

    @PatchMapping("/llm/providers/{id}")
    public ApiResponse<LlmProvider> updateProvider(@PathVariable String id,
                                                   @RequestBody LlmProviderUpdateRequest req) {
        LlmProvider patch = new LlmProvider();
        patch.setName(req.getName());
        patch.setProvider(req.getProvider());
        patch.setApiKey(req.getApiKey());
        patch.setBaseUrl(req.getBaseUrl());
        patch.setModel(req.getModel());
        if (Boolean.TRUE.equals(req.getIsDefault())) patch.setDefaultProvider(true);
        if (Boolean.TRUE.equals(req.getEnabled()))   patch.setEnabled(true);
        return ApiResponse.ok(llmConfigService.updateProvider(id, patch));
    }

    @DeleteMapping("/llm/providers/{id}")
    public ApiResponse<Void> deleteProvider(@PathVariable String id) {
        llmConfigService.deleteProvider(id);
        return ApiResponse.ok();
    }

    @GetMapping("/llm/workflows")
    public ApiResponse<List<WorkflowLlmConfig>> listWorkflows() {
        return ApiResponse.ok(llmConfigService.listWorkflowConfigs());
    }

    @PatchMapping("/llm/workflows/{type}")
    public ApiResponse<Void> updateWorkflow(@PathVariable String type,
                                            @RequestBody WorkflowLlmConfigRequest req) {
        llmConfigService.updateWorkflowConfig(type, req.getProviderId(), req.getModelOverride(), req.getTemperature());
        return ApiResponse.ok();
    }

    @GetMapping("/system")
    public ApiResponse<Map<String, String>> getSystemConfig() {
        return ApiResponse.ok(systemConfigService.getAll());
    }

    @PatchMapping("/system")
    public ApiResponse<Void> updateSystemConfig(@Valid @RequestBody SystemConfigUpdateRequest req) {
        systemConfigService.updateAll(req.getConfigs());
        return ApiResponse.ok();
    }
}
