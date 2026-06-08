package com.nexus.dto.request;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class WorkflowLlmConfigRequest {
    private String providerId;
    private String modelOverride;
    private BigDecimal temperature;
}
