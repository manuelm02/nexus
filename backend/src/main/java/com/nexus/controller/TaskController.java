package com.nexus.controller;

import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.Task;
import com.nexus.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
