package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.response.SubscriptionCategoryResponse;
import com.nexus.entity.SubscriptionCategory;
import com.nexus.mapper.SubscriptionCategoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/** 订阅分类管理服务：增删查，create 去重不抛异常。 */
@Service
@RequiredArgsConstructor
public class SubscriptionCategoryService {

    private final SubscriptionCategoryMapper categoryMapper;

    /** 返回全部分类，按 name 排序。 */
    public List<SubscriptionCategoryResponse> list() {
        return categoryMapper.selectList(new LambdaQueryWrapper<SubscriptionCategory>()
                .orderByAsc(SubscriptionCategory::getName))
                .stream()
                .map(SubscriptionCategoryResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * 创建分类，若同名已存在则直接返回已有记录（AI 识别流程会频繁尝试插入同名分类）。
     */
    public SubscriptionCategoryResponse create(String name) {
        SubscriptionCategory existing = categoryMapper.selectOne(
                new LambdaQueryWrapper<SubscriptionCategory>()
                        .eq(SubscriptionCategory::getName, name));
        if (existing != null) {
            return SubscriptionCategoryResponse.from(existing);
        }
        SubscriptionCategory category = new SubscriptionCategory();
        category.setName(name);
        categoryMapper.insert(category);
        return SubscriptionCategoryResponse.from(category);
    }

    /** 删除分类，不存在时抛异常。 */
    public void delete(String id) {
        if (categoryMapper.selectById(id) == null) {
            throw new IllegalArgumentException("分类不存在: " + id);
        }
        categoryMapper.deleteById(id);
    }

    /** 返回所有分类名称列表，供 AI 识别使用。 */
    public List<String> listNames() {
        return categoryMapper.selectList(new LambdaQueryWrapper<SubscriptionCategory>()
                .orderByAsc(SubscriptionCategory::getName))
                .stream()
                .map(SubscriptionCategory::getName)
                .collect(Collectors.toList());
    }
}
