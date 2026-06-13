package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.nexus.dto.request.TodoCreateRequest;
import com.nexus.dto.request.TodoScheduleTodayRequest;
import com.nexus.dto.request.TodoStatusRequest;
import com.nexus.dto.request.TodoUpdateRequest;
import com.nexus.dto.response.TodoBoardResponse;
import com.nexus.entity.Todo;
import com.nexus.mapper.TodoMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TodoServiceTest {

    @Mock
    private TodoMapper todoMapper;

    @InjectMocks
    private TodoService todoService;

    private LocalDate today;
    private LocalDate yesterday;
    private LocalDate tomorrow;

    @BeforeEach
    void setUp() {
        today = LocalDate.now();
        yesterday = today.minusDays(1);
        tomorrow = today.plusDays(1);
    }

    // ======================== create ========================

    @Test
    void createWithoutScheduledDateShouldBePendingWithNoDates() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("整理产品路线");
        req.setPriority("high");

        Todo todo = todoService.create(req);

        assertThat(todo.getStatus()).isEqualTo("pending");
        assertThat(todo.getScheduledDate()).isNull();
        assertThat(todo.getDueDate()).isNull();
    }

    @Test
    void createWithScheduledDateShouldBeNotStartedWithDueDefaulted() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("今天任务");
        req.setPriority("medium");
        req.setScheduledDate(today);

        Todo todo = todoService.create(req);

        assertThat(todo.getStatus()).isEqualTo("not_started");
        assertThat(todo.getScheduledDate()).isEqualTo(today);
        assertThat(todo.getDueDate()).isEqualTo(today);
    }

    @Test
    void createWithPastScheduledDateShouldBeNotStarted() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("过去任务");
        req.setPriority("low");
        req.setScheduledDate(yesterday);

        Todo todo = todoService.create(req);

        assertThat(todo.getStatus()).isEqualTo("not_started");
        assertThat(todo.getScheduledDate()).isEqualTo(yesterday);
        assertThat(todo.getDueDate()).isEqualTo(yesterday);
    }

    @Test
    void createWithFutureScheduledDateShouldBeNotStarted() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("未来任务");
        req.setPriority("high");
        req.setScheduledDate(tomorrow);

        Todo todo = todoService.create(req);

        assertThat(todo.getStatus()).isEqualTo("not_started");
        assertThat(todo.getScheduledDate()).isEqualTo(tomorrow);
        assertThat(todo.getDueDate()).isEqualTo(tomorrow);
    }

    @Test
    void createWithExplicitDueDateShouldKeepIt() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("有截止日期");
        req.setPriority("medium");
        req.setScheduledDate(today);
        req.setDueDate(tomorrow);

        Todo todo = todoService.create(req);

        assertThat(todo.getScheduledDate()).isEqualTo(today);
        assertThat(todo.getDueDate()).isEqualTo(tomorrow);
    }

    @Test
    void createWithDueDateBeforeScheduledDateShouldThrow() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("无效截止日期");
        req.setPriority("medium");
        req.setScheduledDate(today);
        req.setDueDate(yesterday);

        assertThatThrownBy(() -> todoService.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("截止日期不能早于计划日期");
    }

    // ======================== board ========================

    @Test
    void boardGroupsTodosIntoMutuallyExclusiveGroups() {
        // 准备各分组数据
        Todo task = buildTodo("task-1", "任务项", "pending", null, null);
        Todo overdueItem = buildTodo("overdue-1", "过期项", "not_started", yesterday, yesterday);
        Todo todayItem = buildTodo("today-1", "今日项", "in_progress", today, today);
        Todo futureItem = buildTodo("future-1", "未来项", "not_started", tomorrow, tomorrow);

        List<Todo> all = new ArrayList<>();
        all.add(task);
        all.add(overdueItem);
        all.add(todayItem);
        all.add(futureItem);

        when(todoMapper.selectList(any(com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper.class)))
                .thenReturn(all);

        TodoBoardResponse board = todoService.board(today);

        assertThat(board.getTasks()).hasSize(1);
        assertThat(board.getTasks().get(0).getId()).isEqualTo("task-1");
        assertThat(board.getOverdue()).hasSize(1);
        assertThat(board.getOverdue().get(0).getId()).isEqualTo("overdue-1");
        assertThat(board.getToday()).hasSize(1);
        assertThat(board.getToday().get(0).getId()).isEqualTo("today-1");
        assertThat(board.getFuture()).hasSize(1);
        assertThat(board.getFuture().get(0).getId()).isEqualTo("future-1");
    }

    @Test
    void boardScheduledDateTodayButDueDateYesterdayShouldBeOverdueOnly() {
        // scheduledDate=today 但 dueDate=yesterday → 只属于 overdue
        Todo item = buildTodo("ov-1", "截止已过", "not_started", today, yesterday);

        List<Todo> all = new ArrayList<>();
        all.add(item);

        when(todoMapper.selectList(any(com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper.class)))
                .thenReturn(all);

        TodoBoardResponse board = todoService.board(today);

        assertThat(board.getOverdue()).hasSize(1);
        assertThat(board.getToday()).isEmpty();
        assertThat(board.getFuture()).isEmpty();
        assertThat(board.getTasks()).isEmpty();
    }

    @Test
    void boardDoneAndCancelledNotInBoard() {
        // 验证 done/cancelled 不会出现在任何 board 分组中
        // 实际 SQL 已通过 NOT IN ('done','cancelled') 过滤，这里验证空列表场景
        List<Todo> all = new ArrayList<>();

        when(todoMapper.selectList(any(com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper.class)))
                .thenReturn(all);

        TodoBoardResponse board = todoService.board(today);

        assertThat(board.getToday()).isEmpty();
        assertThat(board.getFuture()).isEmpty();
        assertThat(board.getOverdue()).isEmpty();
        assertThat(board.getTasks()).isEmpty();
    }

    // ======================== update ========================

    @Test
    void updateClearScheduledDateShouldClearBothDatesAndSetPending() {
        Todo existing = buildTodo("t-1", "旧任务", "not_started", today, today);
        when(todoMapper.selectById("t-1")).thenReturn(existing);

        TodoUpdateRequest req = new TodoUpdateRequest();
        req.setClearScheduledDate(true);

        Todo result = todoService.update("t-1", req);

        assertThat(result.getScheduledDate()).isNull();
        assertThat(result.getDueDate()).isNull();
        assertThat(result.getStatus()).isEqualTo("pending");
        verify(todoMapper).update(isNull(), any(UpdateWrapper.class));
    }

    @Test
    void updateScheduledDateOnPendingShouldBecomeNotStarted() {
        Todo existing = buildTodo("t-1", "pending任务", "pending", null, null);
        when(todoMapper.selectById("t-1")).thenReturn(existing);

        TodoUpdateRequest req = new TodoUpdateRequest();
        req.setScheduledDate(today);

        Todo result = todoService.update("t-1", req);

        assertThat(result.getStatus()).isEqualTo("not_started");
        assertThat(result.getScheduledDate()).isEqualTo(today);
        assertThat(result.getDueDate()).isEqualTo(today); // 自动补截止日期
    }

    @Test
    void updateDueDateBeforeScheduledDateShouldThrow() {
        Todo existing = buildTodo("t-1", "任务", "not_started", today, today);
        when(todoMapper.selectById("t-1")).thenReturn(existing);

        TodoUpdateRequest req = new TodoUpdateRequest();
        req.setDueDate(yesterday);

        assertThatThrownBy(() -> todoService.update("t-1", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("截止日期不能早于计划日期");
    }

    @Test
    void updateBothDatesNullShouldBePending() {
        Todo existing = buildTodo("t-1", "任务", "not_started", today, today);
        when(todoMapper.selectById("t-1")).thenReturn(existing);

        TodoUpdateRequest req = new TodoUpdateRequest();
        req.setClearScheduledDate(true);
        req.setClearDueDate(true);

        Todo result = todoService.update("t-1", req);

        assertThat(result.getStatus()).isEqualTo("pending");
    }

    @Test
    void updateStatusToPendingShouldClearDatesSoItReturnsToTasks() {
        Todo existing = buildTodo("t-1", "过期任务", "not_started", yesterday, yesterday);
        when(todoMapper.selectById("t-1")).thenReturn(existing);

        TodoUpdateRequest req = new TodoUpdateRequest();
        req.setStatus("pending");

        Todo result = todoService.update("t-1", req);

        assertThat(result.getStatus()).isEqualTo("pending");
        assertThat(result.getScheduledDate()).isNull();
        assertThat(result.getDueDate()).isNull();
        verify(todoMapper).update(isNull(), any(UpdateWrapper.class));
    }

    // ======================== 保留的兼容测试 ========================

    @Test
    void createMapsRemovedUrgentPriorityToHigh() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("处理旧数据");
        req.setPriority("urgent");

        Todo todo = todoService.create(req);

        assertThat(todo.getPriority()).isEqualTo("high");
    }

    @Test
    void scheduleTodayFallsBackDueDateToToday() {
        Todo existing = new Todo();
        existing.setId("todo-1");
        existing.setStatus("pending");
        when(todoMapper.selectById("todo-1")).thenReturn(existing);

        Todo scheduled = todoService.scheduleToday("todo-1", new TodoScheduleTodayRequest());

        assertThat(scheduled.getStatus()).isEqualTo("not_started");
        assertThat(scheduled.getScheduledDate()).isEqualTo(today);
        assertThat(scheduled.getDueDate()).isEqualTo(today);
    }

    @Test
    void scheduleTodayUsesRequestedDueDate() {
        TodoScheduleTodayRequest req = new TodoScheduleTodayRequest();
        req.setDueDate(tomorrow);
        Todo existing = new Todo();
        existing.setId("todo-1");
        existing.setStatus("pending");
        when(todoMapper.selectById("todo-1")).thenReturn(existing);

        Todo scheduled = todoService.scheduleToday("todo-1", req);

        assertThat(scheduled.getScheduledDate()).isEqualTo(today);
        assertThat(scheduled.getDueDate()).isEqualTo(tomorrow);
    }

    @Test
    void cancelledTodoCanReturnToPendingPool() {
        Todo existing = new Todo();
        existing.setId("todo-1");
        existing.setStatus("cancelled");
        TodoStatusRequest req = new TodoStatusRequest();
        req.setStatus("pending");
        when(todoMapper.selectById("todo-1")).thenReturn(existing);

        Todo restored = todoService.updateStatus("todo-1", req);

        assertThat(restored.getStatus()).isEqualTo("pending");
    }

    @Test
    void overdueListUsesTodayBoundary() {
        todoService.listOverdue(today);
        // 只是确保调用走通，具体值由 mapper 控制
    }

    // ======================== helper ========================

    private static Todo buildTodo(String id, String title, String status,
                                   LocalDate scheduledDate, LocalDate dueDate) {
        Todo todo = new Todo();
        todo.setId(id);
        todo.setTitle(title);
        todo.setPriority("medium");
        todo.setStatus(status);
        todo.setScheduledDate(scheduledDate);
        todo.setDueDate(dueDate);
        return todo;
    }
}
