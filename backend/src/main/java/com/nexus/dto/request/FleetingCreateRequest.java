package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class FleetingCreateRequest {
    private String title;

    @NotBlank(message = "内容不能为空")
    private String content;

    private List<String> tags;
}
