package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RadarRequest {
    @NotBlank(message = "URL 不能为空")
    private String url;

    private String note;  // 用户备注
}
