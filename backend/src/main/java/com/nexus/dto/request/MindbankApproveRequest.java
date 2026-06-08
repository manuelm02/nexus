package com.nexus.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class MindbankApproveRequest {
    private String title;
    private String domain;
    private List<String> tags;
    private String summary;
}
