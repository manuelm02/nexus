package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.Task;
import com.nexus.mapper.TaskMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 异步任务生命周期服务——未来 Crawl 导入、批量处理、订阅同步、AI 长任务等共用的预留基础设施。
 * <p>
 * 当前业务模块暂未调用 create() / markRunning() / markCompleted() / markFailed() 等生命周期方法，
 * 前台也暂不显性暴露入口。各模块接入时应统一通过该服务创建和流转状态，
 * 避免各自维护分散的任务表和生命周期。
 * </p>
 */
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
