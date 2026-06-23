package com.nexus.controller;

import com.nexus.dto.request.CredentialCreateRequest;
import com.nexus.dto.request.CredentialUpdateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.CredentialResponse;
import com.nexus.service.CredentialService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 账号凭据管理 REST API：管理各平台登录账号、密码和 TOTP 密钥的加密存储 */
@RestController
@RequestMapping("/api/v1/credentials")
@RequiredArgsConstructor
public class CredentialController {

    private final CredentialService credentialService;

    @GetMapping
    public ApiResponse<List<CredentialResponse>> list() {
        return ApiResponse.ok(credentialService.list());
    }

    @PostMapping
    public ApiResponse<CredentialResponse> create(@Valid @RequestBody CredentialCreateRequest req) {
        return ApiResponse.ok(credentialService.create(req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<CredentialResponse> update(@PathVariable String id,
                                                   @RequestBody CredentialUpdateRequest req) {
        return ApiResponse.ok(credentialService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        credentialService.delete(id);
        return ApiResponse.ok();
    }

    /** 解密返回明文密码，用 POST 防止浏览器缓存和 URL 历史泄漏 */
    @PostMapping("/{id}/reveal-password")
    public ApiResponse<String> revealPassword(@PathVariable String id) {
        return ApiResponse.ok(credentialService.revealPassword(id));
    }

    /** 解密返回明文 TOTP 密钥，用 POST 防止浏览器缓存和 URL 历史泄漏 */
    @PostMapping("/{id}/reveal-totp")
    public ApiResponse<String> revealTotp(@PathVariable String id) {
        return ApiResponse.ok(credentialService.revealTotpSecret(id));
    }
}
