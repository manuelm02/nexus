package com.nexus.dto.request;

import lombok.Data;

import java.time.LocalDate;

/** PATCH 更新凭证，全部字段 nullable，null 表示不更新 */
@Data
public class CredentialUpdateRequest {
    private String platform;
    private String label;
    private String category;
    private String username;
    /** 若提供则 Service 重新加密存储 */
    private String password;
    /** 若提供则 Service 重新加密存储 */
    private String totpSecret;
    private String url;
    private LocalDate expireDate;
    private String subscriptionId;
    private Boolean archived;
    private String notes;
}
