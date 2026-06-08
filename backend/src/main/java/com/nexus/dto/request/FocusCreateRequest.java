package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class FocusCreateRequest {
    @NotBlank(message = "标题不能为空")
    @Size(max = 500)
    private String title;

    private String description;

    private String priority = "medium";  // low|medium|high|urgent

    private LocalDate scheduledDate;

    private LocalDate dueDate;
}
