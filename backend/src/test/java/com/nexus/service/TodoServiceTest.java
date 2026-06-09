package com.nexus.service;

import com.nexus.dto.request.TodoCreateRequest;
import com.nexus.dto.request.TodoScheduleTodayRequest;
import com.nexus.dto.request.TodoStatusRequest;
import com.nexus.entity.Todo;
import com.nexus.mapper.TodoMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TodoServiceTest {

    @Mock
    private TodoMapper todoMapper;

    @InjectMocks
    private TodoService todoService;

    @Test
    void createKeepsNewTodoInPendingPool() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("整理产品路线");
        req.setPriority("high");

        Todo todo = todoService.create(req);

        assertThat(todo.getStatus()).isEqualTo("pending");
        assertThat(todo.getScheduledDate()).isNull();
        assertThat(todo.getDueDate()).isNull();
        verify(todoMapper).insert(todo);
    }

    @Test
    void createMapsRemovedUrgentPriorityToHigh() {
        TodoCreateRequest req = new TodoCreateRequest();
        req.setTitle("处理旧数据");
        req.setPriority("urgent");

        Todo todo = todoService.create(req);

        assertThat(todo.getPriority()).isEqualTo("high");
        verify(todoMapper).insert(todo);
    }

    @Test
    void scheduleTodayFallsBackDueDateToToday() {
        LocalDate today = LocalDate.now();
        Todo existing = new Todo();
        existing.setId("todo-1");
        existing.setStatus("pending");
        when(todoMapper.selectById("todo-1")).thenReturn(existing);

        Todo scheduled = todoService.scheduleToday("todo-1", new TodoScheduleTodayRequest());

        assertThat(scheduled.getStatus()).isEqualTo("not_started");
        assertThat(scheduled.getScheduledDate()).isEqualTo(today);
        assertThat(scheduled.getDueDate()).isEqualTo(today);
        verify(todoMapper).updateById(existing);
    }

    @Test
    void scheduleTodayUsesRequestedDueDate() {
        LocalDate dueDate = LocalDate.now().plusDays(3);
        TodoScheduleTodayRequest req = new TodoScheduleTodayRequest();
        req.setDueDate(dueDate);
        Todo existing = new Todo();
        existing.setId("todo-1");
        existing.setStatus("pending");
        when(todoMapper.selectById("todo-1")).thenReturn(existing);

        Todo scheduled = todoService.scheduleToday("todo-1", req);

        assertThat(scheduled.getScheduledDate()).isEqualTo(LocalDate.now());
        assertThat(scheduled.getDueDate()).isEqualTo(dueDate);
        verify(todoMapper).updateById(existing);
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
        verify(todoMapper).updateById(existing);
    }

    @Test
    void overdueListUsesTodayBoundary() {
        LocalDate today = LocalDate.now();

        todoService.listOverdue(today);

        verify(todoMapper).selectOverdue(today);
    }
}
