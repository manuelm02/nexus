package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class ForgeStartRequest {
    private String problemId;

    @NotBlank(message = "题目标题不能为空")
    private String problemTitle;

    private String problemUrl;
    private String difficulty;  // easy|medium|hard
    private List<String> tags;
    private String mySolution;  // 初始代码（可选）
}
