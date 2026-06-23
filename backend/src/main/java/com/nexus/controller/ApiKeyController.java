package com.nexus.controller;

import com.nexus.dto.request.ApiKeyConsumeRequest;
import com.nexus.dto.request.ApiKeyCreateRequest;
import com.nexus.dto.request.ApiKeyRechargeRequest;
import com.nexus.dto.request.ApiKeyUpdateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.ApiKeyResponse;
import com.nexus.entity.ApiKeyBalanceSnapshot;
import com.nexus.entity.ApiKeyLedgerEntry;
import com.nexus.service.ApiKeyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** API Key 保险箱 REST API：管理各平台 API 密钥的存储、余额同步、充消记录 */
@RestController
@RequestMapping("/api/v1/api-keys")
@RequiredArgsConstructor
public class ApiKeyController {

    private final ApiKeyService apiKeyService;

    @GetMapping
    public ApiResponse<List<ApiKeyResponse>> list() {
        return ApiResponse.ok(apiKeyService.list());
    }

    @PostMapping
    public ApiResponse<ApiKeyResponse> create(@Valid @RequestBody ApiKeyCreateRequest req) {
        return ApiResponse.ok(apiKeyService.create(req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<ApiKeyResponse> update(@PathVariable String id,
                                               @RequestBody ApiKeyUpdateRequest req) {
        return ApiResponse.ok(apiKeyService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        apiKeyService.delete(id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/recharge")
    public ApiResponse<ApiKeyResponse> recharge(@PathVariable String id,
                                                 @Valid @RequestBody ApiKeyRechargeRequest req) {
        return ApiResponse.ok(apiKeyService.recharge(id, req));
    }

    @PostMapping("/{id}/consume")
    public ApiResponse<ApiKeyResponse> consume(@PathVariable String id,
                                                @Valid @RequestBody ApiKeyConsumeRequest req) {
        return ApiResponse.ok(apiKeyService.consume(id, req));
    }

    @PostMapping("/{id}/sync-balance")
    public ApiResponse<ApiKeyResponse> syncBalance(@PathVariable String id) {
        return ApiResponse.ok(apiKeyService.syncBalance(id));
    }

    @GetMapping("/{id}/ledger")
    public ApiResponse<List<ApiKeyLedgerEntry>> ledger(@PathVariable String id,
                                                        @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(apiKeyService.getLedger(id, limit));
    }

    @GetMapping("/{id}/balance-history")
    public ApiResponse<List<ApiKeyBalanceSnapshot>> balanceHistory(@PathVariable String id,
                                                                    @RequestParam(defaultValue = "30") int days) {
        return ApiResponse.ok(apiKeyService.getBalanceHistory(id, days));
    }

    /** 解密返回明文 API Key，用 POST 防止浏览器缓存和 URL 历史泄漏 */
    @PostMapping("/{id}/reveal-key")
    public ApiResponse<String> revealKey(@PathVariable String id) {
        return ApiResponse.ok(apiKeyService.revealKey(id));
    }
}
