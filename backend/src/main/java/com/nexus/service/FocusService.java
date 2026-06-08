package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.FocusCreateRequest;
import com.nexus.dto.request.FocusStatusRequest;
import com.nexus.dto.request.FocusUpdateRequest;
import com.nexus.entity.Focus;
import com.nexus.mapper.FocusMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FocusService {

    private final FocusMapper focusMapper;

    public List<Focus> list(String status, LocalDate date) {
        LambdaQueryWrapper<Focus> q = new LambdaQueryWrapper<Focus>()
                .orderByDesc(Focus::getCreatedAt);
        if (status != null) q.eq(Focus::getStatus, status);
        if (date != null) q.eq(Focus::getScheduledDate, date);
        return focusMapper.selectList(q);
    }

    public Focus create(FocusCreateRequest req) {
        Focus focus = new Focus();
        focus.setTitle(req.getTitle());
        focus.setDescription(req.getDescription());
        focus.setPriority(req.getPriority() != null ? req.getPriority() : "medium");
        focus.setStatus("not_started");
        focus.setScheduledDate(req.getScheduledDate() != null ? req.getScheduledDate() : LocalDate.now());
        focus.setDueDate(req.getDueDate());
        focusMapper.insert(focus);
        return focus;
    }

    public Focus updateStatus(String id, FocusStatusRequest req) {
        Focus focus = getOrThrow(id);
        focus.setStatus(req.getStatus());
        focusMapper.updateById(focus);
        return focus;
    }

    public Focus update(String id, FocusUpdateRequest req) {
        Focus focus = getOrThrow(id);
        if (req.getTitle() != null) focus.setTitle(req.getTitle());
        if (req.getDescription() != null) focus.setDescription(req.getDescription());
        if (req.getPriority() != null) focus.setPriority(req.getPriority());
        if (req.getStatus() != null) focus.setStatus(req.getStatus());
        if (req.getScheduledDate() != null) focus.setScheduledDate(req.getScheduledDate());
        if (req.getDueDate() != null) focus.setDueDate(req.getDueDate());
        focusMapper.updateById(focus);
        return focus;
    }

    public void delete(String id) {
        getOrThrow(id);
        focusMapper.deleteById(id);
    }

    private Focus getOrThrow(String id) {
        Focus focus = focusMapper.selectById(id);
        if (focus == null) throw new IllegalArgumentException("Focus 不存在: " + id);
        return focus;
    }
}
