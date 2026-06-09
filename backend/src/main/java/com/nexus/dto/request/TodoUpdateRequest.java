package com.nexus.dto.request;

import lombok.Data;

import java.time.LocalDate;

@Data
public class TodoUpdateRequest {
    private String title;
    private String description;
    private String priority;
    private String status;
    private LocalDate scheduledDate;
    private LocalDate dueDate;
}
