package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.CredentialCreateRequest;
import com.nexus.dto.request.CredentialUpdateRequest;
import com.nexus.dto.response.CredentialResponse;
import com.nexus.entity.Credential;
import com.nexus.mapper.CredentialMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/** 账号凭证管理服务：管理各平台登录账号、密码和 TOTP 密钥的加密存储与到期提醒 */
@Service
@RequiredArgsConstructor
public class CredentialService {

    private final CredentialMapper credentialMapper;
    private final LlmConfigService llmConfigService;

    /**
     * 列出所有非归档凭证，按创建时间倒序。
     */
    public List<CredentialResponse> list() {
        return credentialMapper.selectList(new LambdaQueryWrapper<Credential>()
                .eq(Credential::isArchived, false)
                .orderByDesc(Credential::getCreatedAt))
                .stream()
                .map(CredentialResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * 列出所有已归档凭证。
     */
    public List<CredentialResponse> listArchived() {
        return credentialMapper.selectList(new LambdaQueryWrapper<Credential>()
                .eq(Credential::isArchived, true)
                .orderByDesc(Credential::getCreatedAt))
                .stream()
                .map(CredentialResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * 创建凭证：password 和 totpSecret 非空时加密存储。
     */
    public CredentialResponse create(CredentialCreateRequest req) {
        Credential entity = new Credential();
        entity.setPlatform(req.getPlatform());
        entity.setLabel(req.getLabel());
        entity.setCategory(req.getCategory());
        entity.setUsername(req.getUsername());
        // 密码加密存储
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            entity.setEncryptedPassword(llmConfigService.encrypt(req.getPassword()));
        }
        // TOTP 密钥加密存储
        if (req.getTotpSecret() != null && !req.getTotpSecret().isBlank()) {
            entity.setEncryptedTotpSecret(llmConfigService.encrypt(req.getTotpSecret()));
        }
        entity.setUrl(req.getUrl());
        entity.setExpireDate(req.getExpireDate());
        entity.setSubscriptionId(req.getSubscriptionId());
        entity.setNotes(req.getNotes());
        entity.setArchived(false);

        credentialMapper.insert(entity);
        return CredentialResponse.from(entity);
    }

    /**
     * PATCH 语义更新凭证：只更新非 null 字段；password/totpSecret 若有值则重新加密。
     */
    public CredentialResponse update(String id, CredentialUpdateRequest req) {
        Credential entity = getOrThrow(id);
        if (req.getPlatform() != null) entity.setPlatform(req.getPlatform());
        if (req.getLabel() != null) entity.setLabel(req.getLabel());
        if (req.getCategory() != null) entity.setCategory(req.getCategory());
        if (req.getUsername() != null) entity.setUsername(req.getUsername());
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            entity.setEncryptedPassword(llmConfigService.encrypt(req.getPassword()));
        }
        if (req.getTotpSecret() != null && !req.getTotpSecret().isBlank()) {
            entity.setEncryptedTotpSecret(llmConfigService.encrypt(req.getTotpSecret()));
        }
        if (req.getUrl() != null) entity.setUrl(req.getUrl());
        if (req.getExpireDate() != null) entity.setExpireDate(req.getExpireDate());
        if (req.getSubscriptionId() != null) entity.setSubscriptionId(req.getSubscriptionId());
        if (req.getArchived() != null) entity.setArchived(req.getArchived());
        if (req.getNotes() != null) entity.setNotes(req.getNotes());
        credentialMapper.updateById(entity);
        return CredentialResponse.from(entity);
    }

    /**
     * 删除凭证。
     */
    public void delete(String id) {
        getOrThrow(id);
        credentialMapper.deleteById(id);
    }

    /**
     * 解密密码返回明文。
     */
    public String revealPassword(String id) {
        Credential entity = getOrThrow(id);
        if (entity.getEncryptedPassword() == null) return null;
        return llmConfigService.decrypt(entity.getEncryptedPassword());
    }

    /**
     * 解密 TOTP 密钥返回明文。
     */
    public String revealTotpSecret(String id) {
        Credential entity = getOrThrow(id);
        if (entity.getEncryptedTotpSecret() == null) return null;
        return llmConfigService.decrypt(entity.getEncryptedTotpSecret());
    }

    /**
     * 查找 N 天内即将到期的凭证（未归档）。
     */
    public List<Credential> findExpiringPasswords(int daysAhead) {
        LocalDate today = LocalDate.now();
        LocalDate threshold = today.plusDays(daysAhead);
        return credentialMapper.selectList(new LambdaQueryWrapper<Credential>()
                .eq(Credential::isArchived, false)
                .isNotNull(Credential::getExpireDate)
                .ge(Credential::getExpireDate, today)
                .le(Credential::getExpireDate, threshold));
    }

    private Credential getOrThrow(String id) {
        Credential entity = credentialMapper.selectById(id);
        if (entity == null) throw new IllegalArgumentException("凭证不存在: " + id);
        return entity;
    }
}
