package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * LLM Provider 实体，对应 llm_providers 表。
 *
 * 字段说明：
 *   - apiKey：AES/ECB 加密存储，@JsonIgnore 防止序列化到 API 响应（前端不可见）
 *   - defaultProvider：使用 @TableField("is_default") 显式指定列名。
 *     注意：MyBatis-Plus 的 lambda 缓存不能处理 boolean isXxx 命名（会解析为属性 "default"），
 *     因此这里故意使用 "defaultProvider" 而非 "isDefault"，以避免 lambda cache 异常。
 */
@Data
@TableName("llm_providers")
public class LlmProvider {

    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /** Provider 的显示名称，由用户自定义（如"我的 GPT-4"） */
    private String name;

    /** Provider 类型标识，对应 buildModel 中的 switch：openai|anthropic|deepseek|ollama */
    private String provider;

    /** AES 加密的 API Key，读取时需先调用 LlmConfigService.decrypt()，禁止直接序列化给前端 */
    @JsonIgnore
    private String apiKey;

    /** 仅 Ollama 使用（自托管地址，如 http://localhost:11434），云端 Provider 留空 */
    private String baseUrl;

    /** 默认使用的模型版本，可被工作流的 modelOverride 覆盖 */
    private String model;

    /**
     * 是否为全局默认 Provider。
     * 字段名故意使用 defaultProvider 而非 isDefault，原因见类注释。
     * @TableField 显式映射到数据库列 is_default。
     */
    @TableField("is_default")
    private boolean defaultProvider;

    /** Provider 是否启用，禁用后 resolveModel 不会选中此 Provider */
    private boolean enabled;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
