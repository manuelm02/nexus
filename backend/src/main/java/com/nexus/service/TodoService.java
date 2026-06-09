package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.TodoCreateRequest;
import com.nexus.dto.request.TodoScheduleTodayRequest;
import com.nexus.dto.request.TodoStatusRequest;
import com.nexus.dto.request.TodoUpdateRequest;
import com.nexus.entity.Todo;
import com.nexus.mapper.TodoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/** 管理 ToDo 待办事项的查询、创建、状态更新和删除。 */
@Service
@RequiredArgsConstructor
public class TodoService {

    private final TodoMapper todoMapper;

    /**
     * 查询 ToDo 列表；status/date 均为空时返回全部记录，用于前端历史和分组视图复用。
     *
     * @param status 可选状态筛选，pending/cancelled/not_started/in_progress/done
     * @param date 可选计划日期筛选，仅匹配 scheduledDate
     * @return 按创建时间倒序排列的 ToDo 记录
     */
    public List<Todo> list(String status, LocalDate date) {
        LambdaQueryWrapper<Todo> q = new LambdaQueryWrapper<Todo>()
                .orderByDesc(Todo::getCreatedAt);
        if (status != null) q.eq(Todo::getStatus, status);
        if (date != null) q.eq(Todo::getScheduledDate, date);
        return todoMapper.selectList(q);
    }

    /**
     * 查询已过期且未完成的 ToDo；过期项不能被旧 rollover 自动改到今天，否则用户无法复盘拖延项。
     *
     * @param today 调用方认定的今天，便于测试和跨时区边界控制
     * @return scheduledDate 或 dueDate 已早于 today 且状态不是 done 的记录
     */
    public List<Todo> listOverdue(LocalDate today) {
        return todoMapper.selectOverdue(today);
    }

    /**
     * 创建待分配 ToDo，只接收内容和优先级；日期留空表示尚未承诺进入今日执行。
     *
     * @param req 创建请求，title 为内容，priority 为空时默认 medium
     * @return 已写入数据库的 ToDo
     */
    public Todo create(TodoCreateRequest req) {
        Todo todo = new Todo();
        todo.setTitle(req.getTitle());
        todo.setPriority(normalizePriority(req.getPriority()));
        todo.setStatus("pending");
        todoMapper.insert(todo);
        return todo;
    }

    /**
     * 更新 ToDo 状态；允许 pending/cancelled 互转，也允许今日执行态手动推进。
     *
     * @param id ToDo 主键
     * @param req 新状态请求
     * @return 更新后的 ToDo
     */
    public Todo updateStatus(String id, TodoStatusRequest req) {
        Todo todo = getOrThrow(id);
        todo.setStatus(req.getStatus());
        todoMapper.updateById(todo);
        return todo;
    }

    /**
     * 将待分配 ToDo 选入今日；dueDate 未指定时以今天兜底，避免今日项没有明确截止日期。
     *
     * @param id ToDo 主键
     * @param req 可选截止日期
     * @return 更新后的 ToDo
     */
    public Todo scheduleToday(String id, TodoScheduleTodayRequest req) {
        Todo todo = getOrThrow(id);
        LocalDate today = LocalDate.now();
        todo.setStatus("not_started");
        todo.setScheduledDate(today);
        todo.setDueDate(req.getDueDate() != null ? req.getDueDate() : today);
        todoMapper.updateById(todo);
        return todo;
    }

    /**
     * 局部更新 ToDo 字段，主要用于已过期分组中修正状态、计划日期和截止日期。
     *
     * @param id ToDo 主键
     * @param req 需要覆盖的字段，null 表示保持不变
     * @return 更新后的 ToDo
     */
    public Todo update(String id, TodoUpdateRequest req) {
        Todo todo = getOrThrow(id);
        if (req.getTitle() != null) todo.setTitle(req.getTitle());
        if (req.getDescription() != null) todo.setDescription(req.getDescription());
        if (req.getPriority() != null) todo.setPriority(normalizePriority(req.getPriority()));
        if (req.getStatus() != null) todo.setStatus(req.getStatus());
        if (req.getScheduledDate() != null) todo.setScheduledDate(req.getScheduledDate());
        if (req.getDueDate() != null) todo.setDueDate(req.getDueDate());
        todoMapper.updateById(todo);
        return todo;
    }

    /**
     * 删除 ToDo 记录。
     *
     * @param id ToDo 主键
     */
    public void delete(String id) {
        getOrThrow(id);
        todoMapper.deleteById(id);
    }

    private Todo getOrThrow(String id) {
        Todo todo = todoMapper.selectById(id);
        if (todo == null) throw new IllegalArgumentException("Todo 不存在: " + id);
        return todo;
    }

    private String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) return "medium";
        return switch (priority) {
            case "low", "medium", "high" -> priority;
            case "urgent" -> "high";
            default -> "medium";
        };
    }
}
