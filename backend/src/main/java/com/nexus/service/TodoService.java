package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.nexus.dto.request.TodoCreateRequest;
import com.nexus.dto.request.TodoScheduleTodayRequest;
import com.nexus.dto.request.TodoStatusRequest;
import com.nexus.dto.request.TodoUpdateRequest;
import com.nexus.dto.response.TodoBoardResponse;
import com.nexus.entity.Todo;
import com.nexus.mapper.TodoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** 管理 ToDo 待办事项的查询、看板分组、创建、更新和删除。 */
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
     * @return scheduledDate 或 dueDate 已早于 today 且状态不是 done/cancelled 的记录
     */
    public List<Todo> listOverdue(LocalDate today) {
        return todoMapper.selectOverdue(today);
    }

    /**
     * 返回看板分组：today / future / overdue / tasks。
     * 后端统一计算分组，保证四个分组互斥，一个 ToDo 只出现在一个分组中。
     * overdue 优先级高于 today/future，done/cancelled 不进入看板。
     *
     * @param today 调用方认定的今天
     * @return 互斥的四个分组
     */
    public TodoBoardResponse board(LocalDate today) {
        // 一次查询所有非历史 ToDo
        List<Todo> all = todoMapper.selectList(
                new LambdaQueryWrapper<Todo>()
                        .notIn(Todo::getStatus, "done", "cancelled")
                        .orderByDesc(Todo::getCreatedAt)
        );

        List<Todo> tasks = new ArrayList<>();
        List<Todo> overdue = new ArrayList<>();
        List<Todo> todayList = new ArrayList<>();
        List<Todo> future = new ArrayList<>();

        for (Todo todo : all) {
            LocalDate scheduled = todo.getScheduledDate();
            LocalDate due = todo.getDueDate();

            // tasks：状态为 pending 且没有日期
            if ("pending".equals(todo.getStatus()) && scheduled == null && due == null) {
                tasks.add(todo);
                continue;
            }

            boolean isOverdue = false;
            if (scheduled != null && scheduled.isBefore(today)) isOverdue = true;
            if (due != null && due.isBefore(today)) isOverdue = true;

            if (isOverdue) {
                overdue.add(todo);
            } else if (scheduled != null && scheduled.isEqual(today)) {
                todayList.add(todo);
            } else if (scheduled != null && scheduled.isAfter(today)) {
                future.add(todo);
            }
            // 有 dueDate 但没有 scheduledDate 且不过期：按 scheduledDate 规则不应进任何分组，忽略
        }

        return new TodoBoardResponse(todayList, future, overdue, tasks);
    }

    /**
     * 创建 ToDo；含日期字段则直接进入计划，否则进入 tasks 分组。
     * 有 scheduledDate 时，status 自动设为 not_started，dueDate 未填时自动等于 scheduledDate。
     *
     * @param req 创建请求
     * @return 已写入数据库的 ToDo
     */
    public Todo create(TodoCreateRequest req) {
        Todo todo = new Todo();
        todo.setTitle(req.getTitle());
        todo.setPriority(normalizePriority(req.getPriority()));

        if (req.getScheduledDate() != null) {
            // 有计划日期：直接进入 not_started，dueDate 未填时兜底为 scheduledDate
            todo.setStatus("not_started");
            todo.setScheduledDate(req.getScheduledDate());
            LocalDate due = req.getDueDate() != null ? req.getDueDate() : req.getScheduledDate();
            // 校验截止日期不能早于计划日期
            if (due.isBefore(req.getScheduledDate())) {
                throw new IllegalArgumentException("截止日期不能早于计划日期");
            }
            todo.setDueDate(due);
        } else {
            // 没有计划日期：进入 tasks（pending 状态）
            todo.setStatus("pending");
            todo.setScheduledDate(null);
            todo.setDueDate(null);
        }

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
     * 保留用于兼容已有客户端。
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
     * 局部更新 ToDo 字段，支持 clearScheduledDate/clearDueDate 显式清空日期。
     * 日期联动规则：
     * - 清空 scheduledDate → 同时清空 dueDate，status 回退为 pending
     * - 设置 scheduledDate 且当前为 pending → status 自动转为 not_started
     * - 设置 scheduledDate 且 dueDate 为空 → dueDate 自动补为 scheduledDate
     * - 设置 dueDate → 校验 dueDate >= scheduledDate
     * - 最终两个日期都为空 → status 回退为 pending
     *
     * @param id ToDo 主键
     * @param req 需要覆盖的字段，null 表示保持不变，clear flag 为 true 表示清空对应日期
     * @return 更新后的 ToDo
     */
    public Todo update(String id, TodoUpdateRequest req) {
        Todo todo = getOrThrow(id);

        if (req.getTitle() != null) todo.setTitle(req.getTitle());
        if (req.getDescription() != null) todo.setDescription(req.getDescription());
        if (req.getPriority() != null) todo.setPriority(normalizePriority(req.getPriority()));
        if (req.getStatus() != null) todo.setStatus(req.getStatus());

        // 处理显式清空日期
        if (Boolean.TRUE.equals(req.getClearScheduledDate())) {
            todo.setScheduledDate(null);
            todo.setDueDate(null);
            todo.setStatus("pending");
        } else if (req.getScheduledDate() != null) {
            // 设置计划日期
            todo.setScheduledDate(req.getScheduledDate());
            // pending 状态自动转为 not_started
            if ("pending".equals(todo.getStatus())) {
                todo.setStatus("not_started");
            }
            // 如果截止日期为空且没有被显式清空，自动补为 scheduledDate
            if (todo.getDueDate() == null && !Boolean.TRUE.equals(req.getClearDueDate())) {
                todo.setDueDate(req.getScheduledDate());
            }
        }

        // 处理显式清空截止日期（在 scheduledDate 处理之后，避免被自动补回）
        if (Boolean.TRUE.equals(req.getClearDueDate())) {
            todo.setDueDate(null);
        } else if (req.getDueDate() != null) {
            // 设置截止日期 - 校验必须 >= 计划日期
            LocalDate scheduled = todo.getScheduledDate();
            if (scheduled != null && req.getDueDate().isBefore(scheduled)) {
                throw new IllegalArgumentException("截止日期不能早于计划日期");
            }
            todo.setDueDate(req.getDueDate());
        }

        // pending 是“任务”页的领域状态，不能携带日期，否则会掉出所有看板分组。
        if ("pending".equals(todo.getStatus())) {
            todo.setScheduledDate(null);
            todo.setDueDate(null);
        }

        // 最终两个日期都为空 → pending
        if (todo.getScheduledDate() == null && todo.getDueDate() == null) {
            todo.setStatus("pending");
        }

        // MyBatis-Plus 的 updateById 默认忽略 null，清空日期必须用字符串列名显式 SET NULL。
        // 这里不用 LambdaUpdateWrapper，是为了避开纯 Mockito 单元测试中 lambda cache 未初始化的问题。
        UpdateWrapper<Todo> update = new UpdateWrapper<Todo>()
                .eq("id", id)
                .set("title", todo.getTitle())
                .set("description", todo.getDescription())
                .set("priority", todo.getPriority())
                .set("status", todo.getStatus())
                .set("scheduled_date", todo.getScheduledDate())
                .set("due_date", todo.getDueDate());
        todoMapper.update(null, update);
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
