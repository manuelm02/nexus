package com.nexus.dto.response;

import com.nexus.entity.Credential;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 凭证对外响应，不暴露加密字段，用 passwordSet/totpSet 标志替代 */
@Data
public class CredentialResponse {
    private String id;
    private String platform;
    private String label;
    private String category;
    private String username;
    /** 是否已设置密码 */
    private boolean passwordSet;
    /** 是否已设置 TOTP 密钥 */
    private boolean totpSet;
    private String url;
    private LocalDate expireDate;
    private String subscriptionId;
    private String notes;
    private boolean archived;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * 将数据库实体转换为响应对象，加密字段仅暴露是否设置标志。
     * @param entity 凭证实体
     * @return 凭证响应对象
     */
    public static CredentialResponse from(Credential entity) {
        CredentialResponse r = new CredentialResponse();
        r.setId(entity.getId());
        r.setPlatform(entity.getPlatform());
        r.setLabel(entity.getLabel());
        r.setCategory(entity.getCategory());
        r.setUsername(entity.getUsername());
        r.setPasswordSet(entity.getEncryptedPassword() != null);
        r.setTotpSet(entity.getEncryptedTotpSecret() != null);
        r.setUrl(entity.getUrl());
        r.setExpireDate(entity.getExpireDate());
        r.setSubscriptionId(entity.getSubscriptionId());
        r.setNotes(entity.getNotes());
        r.setArchived(entity.isArchived());
        r.setCreatedAt(entity.getCreatedAt());
        r.setUpdatedAt(entity.getUpdatedAt());
        return r;
    }
}
