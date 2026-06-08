package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.FleetingCreateRequest;
import com.nexus.entity.Fleeting;
import com.nexus.mapper.FleetingMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FleetingService {

    private final FleetingMapper fleetingMapper;

    public List<Fleeting> list() {
        return fleetingMapper.selectList(new LambdaQueryWrapper<Fleeting>()
                .orderByDesc(Fleeting::getCreatedAt));
    }

    public Fleeting create(FleetingCreateRequest req) {
        Fleeting note = new Fleeting();
        note.setTitle(req.getTitle());
        note.setContent(req.getContent());
        note.setTags(req.getTags());
        fleetingMapper.insert(note);
        return note;
    }

    public void delete(String id) {
        if (fleetingMapper.selectById(id) == null) {
            throw new IllegalArgumentException("Fleeting 不存在: " + id);
        }
        fleetingMapper.deleteById(id);
    }
}
