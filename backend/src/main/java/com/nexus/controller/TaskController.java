package com.nexus.controller;

import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.Task;
import com.nexus.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 通用任务查询接口——接口保留给未来任务中心和内部调试使用。
 * <p>
 * 当前不是所有业务长任务都已接入该表（例如 Mindbank Agent 使用独立的 mindbank_agent_tasks 表），
 * 因此前台暂不显性暴露入口，但列表、详情、保留/删除等基本查询能力已具备。
 * </p>
 */
@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public ApiResponse<List<Task>> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status) {
        return ApiResponse.ok(taskService.list(type, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<Task> getById(@PathVariable String id) {
        return ApiResponse.ok(taskService.getById(id));
    }

    @PatchMapping("/{id}/keep")
    public ApiResponse<Task> toggleKeep(@PathVariable String id) {
        return ApiResponse.ok(taskService.toggleKeep(id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        taskService.delete(id);
        return ApiResponse.ok();
    }
}
