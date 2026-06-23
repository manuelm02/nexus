package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

/** 创建凭证请求，password 和 totpSecret 由 Service 加密存储 */
@Data
public class CredentialCreateRequest {
    @NotBlank(message = "平台不能为空")
    private String platform;

    private String label;
    private String category;
    private String username;
    /** 明文密码，落库前加密 */
    private String password;
    /** Base32 编码的 TOTP 密钥，落库前加密 */
    private String totpSecret;
    private String url;
    private LocalDate expireDate;
    private String subscriptionId;
    private String notes;
}
