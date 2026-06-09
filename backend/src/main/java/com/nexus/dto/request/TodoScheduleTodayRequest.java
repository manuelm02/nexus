package com.nexus.dto.request;

import lombok.Data;

import java.time.LocalDate;

@Data
public class TodoScheduleTodayRequest {
    private LocalDate dueDate;
}
