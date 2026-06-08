package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MindbankFromRadarRequest {
    @NotBlank(message = "radarTaskId 不能为空")
    private String radarTaskId;
}
