package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TodoCreateRequest {
    @NotBlank(message = "标题不能为空")
    @Size(max = 500)
    private String title;

    private String priority = "medium";  // low|medium|high
}
