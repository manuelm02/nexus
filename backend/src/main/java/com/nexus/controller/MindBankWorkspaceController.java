package com.nexus.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.mapper.MindBankWorkspaceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Mindbank Workspace 只读接口，供 Crawl 页面导入弹窗选择 Workspace。
 * 完整 CRUD（POST/PUT/DELETE + AnythingLLM 同步）在 Phase 6.5 实现。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/mindbank/workspaces")
@RequiredArgsConstructor
public class MindBankWorkspaceController {

    private final MindBankWorkspaceMapper mindBankWorkspaceMapper;

    /** 查询所有 Workspace，按创建时间倒序 */
    @GetMapping
    public ApiResponse<List<MindBankWorkspace>> listWorkspaces() {
        return ApiResponse.ok(mindBankWorkspaceMapper.selectList(
                new LambdaQueryWrapper<MindBankWorkspace>()
                        .orderByDesc(MindBankWorkspace::getCreatedAt)));
    }
}
