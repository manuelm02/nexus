package com.nexus.controller;

import com.nexus.dto.request.TodoCreateRequest;
import com.nexus.dto.request.TodoScheduleTodayRequest;
import com.nexus.dto.request.TodoStatusRequest;
import com.nexus.dto.request.TodoUpdateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.TodoBoardResponse;
import com.nexus.entity.Todo;
import com.nexus.service.TodoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** ToDo 待办事项接口，保留 /focus 旧路径用于兼容已有客户端。 */
@RestController
@RequestMapping({"/api/v1/todo", "/api/v1/focus"})
@RequiredArgsConstructor
public class TodoController {

    private final TodoService todoService;

    @GetMapping
    public ApiResponse<List<Todo>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false, defaultValue = "false") boolean overdue) {
        return ApiResponse.ok(overdue ? todoService.listOverdue(LocalDate.now()) : todoService.list(status, date));
    }

    /** 返回看板分组：today / future / overdue / tasks，后端保证四个分组互斥 */
    @GetMapping("/board")
    public ApiResponse<TodoBoardResponse> board() {
        return ApiResponse.ok(todoService.board(LocalDate.now()));
    }

    @PostMapping
    public ApiResponse<Todo> create(@Valid @RequestBody TodoCreateRequest req) {
        return ApiResponse.ok(todoService.create(req));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<Todo> updateStatus(@PathVariable String id,
                                           @Valid @RequestBody TodoStatusRequest req) {
        return ApiResponse.ok(todoService.updateStatus(id, req));
    }

    @PatchMapping("/{id}/schedule-today")
    public ApiResponse<Todo> scheduleToday(@PathVariable String id,
                                           @RequestBody TodoScheduleTodayRequest req) {
        return ApiResponse.ok(todoService.scheduleToday(id, req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Todo> update(@PathVariable String id,
                                     @RequestBody TodoUpdateRequest req) {
        return ApiResponse.ok(todoService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        todoService.delete(id);
        return ApiResponse.ok();
    }
}
