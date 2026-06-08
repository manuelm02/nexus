package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.Task;
import com.nexus.mapper.TaskMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskMapper taskMapper;

    public List<Task> list(String type, String status) {
        LambdaQueryWrapper<Task> q = new LambdaQueryWrapper<Task>()
                .eq(Task::isArchived, false)
                .orderByDesc(Task::getCreatedAt);
        if (type != null) q.eq(Task::getType, type);
        if (status != null) q.eq(Task::getStatus, status);
        return taskMapper.selectList(q);
    }

    public Task getById(String id) {
        Task task = taskMapper.selectById(id);
        if (task == null) throw new IllegalArgumentException("Task 不存在: " + id);
        return task;
    }

    public Task create(String type, Object input, int keepDays) {
        Task task = new Task();
        task.setType(type);
        task.setStatus("pending");
        task.setInput(input);
        task.setExpiresAt(LocalDateTime.now().plusDays(keepDays));
        taskMapper.insert(task);
        return task;
    }

    public Task markRunning(String id) {
        Task task = getById(id);
        task.setStatus("running");
        taskMapper.updateById(task);
        return task;
    }

    public Task markCompleted(String id, String resultText, String resultMarkdown) {
        Task task = getById(id);
        task.setStatus("completed");
        task.setResultText(resultText);
        task.setResultMarkdown(resultMarkdown);
        taskMapper.updateById(task);
        return task;
    }

    public Task markFailed(String id, String errorMessage) {
        Task task = getById(id);
        task.setStatus("failed");
        task.setErrorMessage(errorMessage);
        taskMapper.updateById(task);
        return task;
    }

    public Task toggleKeep(String id) {
        Task task = getById(id);
        task.setKeepForever(!task.isKeepForever());
        taskMapper.updateById(task);
        return task;
    }

    public void delete(String id) {
        getById(id);
        taskMapper.deleteById(id);
    }
}
