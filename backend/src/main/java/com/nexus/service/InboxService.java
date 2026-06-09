package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.InboxCreateRequest;
import com.nexus.entity.InboxItem;
import com.nexus.mapper.InboxMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/** 管理 Inbox 收纳条目的创建、查询和删除。 */
@Service
@RequiredArgsConstructor
public class InboxService {

    private final InboxMapper inboxMapper;

    public List<InboxItem> list() {
        return inboxMapper.selectList(new LambdaQueryWrapper<InboxItem>()
                .orderByDesc(InboxItem::getCreatedAt));
    }

    public InboxItem create(InboxCreateRequest req) {
        InboxItem item = new InboxItem();
        item.setTitle(req.getTitle());
        item.setContent(req.getContent());
        item.setTags(req.getTags());
        inboxMapper.insert(item);
        return item;
    }

    public void delete(String id) {
        if (inboxMapper.selectById(id) == null) {
            throw new IllegalArgumentException("InboxItem 不存在: " + id);
        }
        inboxMapper.deleteById(id);
    }
}
