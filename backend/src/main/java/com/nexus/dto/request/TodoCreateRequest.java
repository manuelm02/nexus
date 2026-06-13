package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class TodoCreateRequest {
    @NotBlank(message = "标题不能为空")
    @Size(max = 500)
    private String title;

    private String priority = "medium";  // low|medium|high

    /** 计划日期，为空则创建为 pending 任务 */
    private LocalDate scheduledDate;

    /** 截止日期，为空且 scheduledDate 不为空时，后端自动用 scheduledDate 填充 */
    private LocalDate dueDate;
}
