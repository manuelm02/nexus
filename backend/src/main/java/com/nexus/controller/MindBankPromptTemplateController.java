package com.nexus.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.CreatePromptTemplateRequest;
import com.nexus.dto.request.UpdatePromptTemplateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.PromptTemplateResponse;
import com.nexus.entity.MindBankPromptTemplate;
import com.nexus.mapper.MindBankPromptTemplateMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Mindbank Prompt 模板管理接口。
 * 内置模板（is_builtin=true）不可编辑/删除，自定义模板支持完整 CRUD。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/mindbank/prompt-templates")
@RequiredArgsConstructor
public class MindBankPromptTemplateController {

    private final MindBankPromptTemplateMapper promptTemplateMapper;

    /** 查询模板列表，type 非空时按 prompt_type 过滤 */
    @GetMapping
    public ApiResponse<List<PromptTemplateResponse>> list(@RequestParam(required = false) String type) {
        LambdaQueryWrapper<MindBankPromptTemplate> wrapper = new LambdaQueryWrapper<>();
        if (type != null && !type.isBlank()) {
            wrapper.eq(MindBankPromptTemplate::getPromptType, type);
        }
        wrapper.orderByAsc(MindBankPromptTemplate::getPromptType)
               .orderByDesc(MindBankPromptTemplate::getDefaultFlag);
        List<PromptTemplateResponse> list = promptTemplateMapper.selectList(wrapper)
            .stream().map(PromptTemplateResponse::fromEntity).toList();
        return ApiResponse.ok(list);
    }

    /** 创建自定义模板，is_builtin 强制 false */
    @PostMapping
    public ApiResponse<PromptTemplateResponse> create(@Valid @RequestBody CreatePromptTemplateRequest req) {
        MindBankPromptTemplate template = new MindBankPromptTemplate();
        template.setName(req.getName());
        template.setPromptType(req.getPromptType());
        template.setContent(req.getContent());
        template.setDefaultFlag(req.getDefaultFlag() != null && req.getDefaultFlag());
        template.setBuiltinFlag(false);

        // 若设为默认，先清除同类型其他默认模板
        if (Boolean.TRUE.equals(template.getDefaultFlag())) {
            clearDefaultForType(template.getPromptType());
        }

        promptTemplateMapper.insert(template);
        return ApiResponse.ok(PromptTemplateResponse.fromEntity(template));
    }

    /** 更新模板，内置模板不可编辑 */
    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody UpdatePromptTemplateRequest req) {
        MindBankPromptTemplate existing = promptTemplateMapper.selectById(id);
        if (existing == null) return ApiResponse.error("模板不存在");
        if (Boolean.TRUE.equals(existing.getBuiltinFlag())) {
            return ApiResponse.error("内置模板不可编辑");
        }

        if (req.getName() != null) existing.setName(req.getName());
        if (req.getContent() != null) existing.setContent(req.getContent());
        if (req.getDefaultFlag() != null) {
            if (req.getDefaultFlag()) {
                clearDefaultForType(existing.getPromptType());
            }
            existing.setDefaultFlag(req.getDefaultFlag());
        }

        promptTemplateMapper.updateById(existing);
        return ApiResponse.ok();
    }

    /** 删除模板，内置模板不可删除 */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        MindBankPromptTemplate existing = promptTemplateMapper.selectById(id);
        if (existing == null) return ApiResponse.error("模板不存在");
        if (Boolean.TRUE.equals(existing.getBuiltinFlag())) {
            return ApiResponse.error("内置模板不可删除");
        }
        promptTemplateMapper.deleteById(id);
        return ApiResponse.ok();
    }

    /** 清除指定类型下所有模板的默认标记，保证同类型只有一个默认 */
    private void clearDefaultForType(String promptType) {
        List<MindBankPromptTemplate> defaults = promptTemplateMapper.selectList(
            new LambdaQueryWrapper<MindBankPromptTemplate>()
                .eq(MindBankPromptTemplate::getPromptType, promptType)
                .eq(MindBankPromptTemplate::getDefaultFlag, true));
        for (MindBankPromptTemplate t : defaults) {
            t.setDefaultFlag(false);
            promptTemplateMapper.updateById(t);
        }
    }
}
