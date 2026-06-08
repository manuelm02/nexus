package com.nexus.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class MindbankInboxRequest {
    private String domain;
    private List<String> tags;
    // 文件通过 MultipartFile 上传，此 DTO 为附加元数据
}
