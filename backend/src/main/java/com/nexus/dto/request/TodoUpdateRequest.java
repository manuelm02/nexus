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

    /** 显式清空计划日期，因为 null 表示"不修改"，必须用 boolean flag 区分 */
    private Boolean clearScheduledDate;

    /** 显式清空截止日期，理由同上 */
    private Boolean clearDueDate;
}
