package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.entity.LlmProvider;
import com.nexus.entity.WorkflowLlmConfig;
import com.nexus.mapper.LlmProviderMapper;
import com.nexus.mapper.WorkflowLlmConfigMapper;
import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.util.List;

/**
 * LLM 配置中心：负责 Provider 的增删改查、工作流模型绑定，以及统一的模型解析入口。
 * 所有需要调用 LLM 的业务代码一律通过 resolveModel(workflowType) 获取模型实例，
 * 不应直接 new 任何 LangChain4j 模型对象。
 */
@Service
@RequiredArgsConstructor
public class LlmConfigService {

    private final LlmProviderMapper llmProviderMapper;
    private final WorkflowLlmConfigMapper workflowLlmConfigMapper;

    /** AES 加密 key，生产环境通过 ENCRYPT_SECRET 环境变量注入，本地用 application-local.yml 覆盖 */
    @Value("${nexus.encrypt.secret:changeme-32-chars-secret-key!!}")
    private String encryptSecret;

    /**
     * 解析指定工作流类型应使用的 ChatLanguageModel 实例。
     * 优先级：工作流绑定的 Provider > 全局默认 Provider。
     * 若两者均未配置，抛出异常由调用方捕获并返回给前端友好提示。
     *
     * @param workflowType 工作流类型标识，对应 workflow_llm_configs.workflow_type（如 "translate"）
     */
    public ChatLanguageModel resolveModel(String workflowType) {
        // 先查工作流是否绑定了特定 Provider
        WorkflowLlmConfig wf = workflowLlmConfigMapper.selectOne(
                new LambdaQueryWrapper<WorkflowLlmConfig>()
                        .eq(WorkflowLlmConfig::getWorkflowType, workflowType));

        LlmProvider provider = null;
        if (wf != null && wf.getProviderId() != null) {
            provider = llmProviderMapper.selectById(wf.getProviderId());
        }
        // 工作流未绑定或绑定的 Provider 已被删除，降级到全局默认
        if (provider == null) {
            provider = llmProviderMapper.selectOne(new LambdaQueryWrapper<LlmProvider>()
                    .eq(LlmProvider::isDefaultProvider, true)
                    .eq(LlmProvider::isEnabled, true));
        }
        if (provider == null) {
            throw new IllegalStateException("未配置可用的 LLM Provider，请在设置页面添加");
        }
        return buildModel(provider, wf);
    }

    /**
     * 根据 Provider 类型构造 LangChain4j 模型实例。
     * modelOverride 优先于 Provider 默认模型，允许工作流级别精细控制版本。
     * DeepSeek 复用 OpenAI 协议，只需改 baseUrl。
     */
    private ChatLanguageModel buildModel(LlmProvider p, WorkflowLlmConfig wf) {
        String model = (wf != null && wf.getModelOverride() != null) ? wf.getModelOverride() : p.getModel();
        // API Key 存储时已加密，此处解密后才能传给 SDK
        String apiKey = decrypt(p.getApiKey());

        return switch (p.getProvider()) {
            case "openai" -> OpenAiChatModel.builder()
                    .apiKey(apiKey).modelName(model).build();
            // DeepSeek 兼容 OpenAI 协议，直接复用 OpenAiChatModel 并指定 baseUrl
            case "deepseek" -> OpenAiChatModel.builder()
                    .apiKey(apiKey).baseUrl("https://api.deepseek.com/v1").modelName(model).build();
            case "anthropic" -> AnthropicChatModel.builder()
                    .apiKey(apiKey).modelName(model).build();
            case "ollama" -> OllamaChatModel.builder()
                    .baseUrl(p.getBaseUrl()).modelName(model).build();
            default -> throw new IllegalStateException("未知 Provider: " + p.getProvider());
        };
    }

    /**
     * AES/ECB 加密 API Key，结果 Base64 编码后存入数据库。
     * ECB 模式对短字符串（API Key）已足够安全；如需更高安全性，升级为 AES/GCM。
     * encryptSecret 必须恰好 32 字符（AES-256 key 长度），不足会被截断。
     */
    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) return plaintext;
        try {
            SecretKeySpec key = new SecretKeySpec(encryptSecret.substring(0, 32).getBytes(), "AES");
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            return Base64.getEncoder().encodeToString(cipher.doFinal(plaintext.getBytes()));
        } catch (Exception e) {
            throw new RuntimeException("加密失败", e);
        }
    }

    /**
     * 解密 API Key。解密失败时静默返回原文，以兼容早期未加密的历史数据。
     * 注意：返回值是明文 API Key，不要打印到日志。
     */
    public String decrypt(String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank()) return ciphertext;
        try {
            SecretKeySpec key = new SecretKeySpec(encryptSecret.substring(0, 32).getBytes(), "AES");
            Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
            cipher.init(Cipher.DECRYPT_MODE, key);
            return new String(cipher.doFinal(Base64.getDecoder().decode(ciphertext)));
        } catch (Exception e) {
            // 解密失败说明可能是未加密的旧数据，原样返回
            return ciphertext;
        }
    }

    /** 返回所有 Provider，API Key 字段已通过 @JsonIgnore 屏蔽，前端不可见 */
    public List<LlmProvider> listProviders() {
        return llmProviderMapper.selectList(null);
    }

    /**
     * 创建 Provider。若设为默认，先将其他所有 Provider 的 defaultProvider 清为 false，
     * 保证全局唯一默认（非原子操作，并发创建时有极小概率出现多个默认，可接受）。
     */
    public LlmProvider createProvider(LlmProvider provider) {
        if (provider.isDefaultProvider()) {
            llmProviderMapper.selectList(new LambdaQueryWrapper<LlmProvider>()
                    .eq(LlmProvider::isDefaultProvider, true))
                    .forEach(p -> { p.setDefaultProvider(false); llmProviderMapper.updateById(p); });
        }
        llmProviderMapper.insert(provider);
        return provider;
    }

    /**
     * PATCH 语义更新 Provider：只更新 patch 中非 null 的字段。
     * apiKey 若有更新，入库前重新加密；defaultProvider 的互斥逻辑同 createProvider。
     */
    public LlmProvider updateProvider(String id, LlmProvider patch) {
        LlmProvider existing = llmProviderMapper.selectById(id);
        if (existing == null) throw new IllegalArgumentException("Provider 不存在: " + id);
        if (patch.getName()     != null) existing.setName(patch.getName());
        if (patch.getProvider() != null) existing.setProvider(patch.getProvider());
        if (patch.getApiKey()   != null) existing.setApiKey(encrypt(patch.getApiKey()));
        if (patch.getBaseUrl()  != null) existing.setBaseUrl(patch.getBaseUrl());
        if (patch.getModel()    != null) existing.setModel(patch.getModel());
        if (patch.isDefaultProvider()) {
            llmProviderMapper.selectList(new LambdaQueryWrapper<LlmProvider>()
                    .eq(LlmProvider::isDefaultProvider, true))
                    .forEach(p -> { p.setDefaultProvider(false); llmProviderMapper.updateById(p); });
            existing.setDefaultProvider(true);
        }
        llmProviderMapper.updateById(existing);
        return existing;
    }

    public void deleteProvider(String id) {
        if (llmProviderMapper.selectById(id) == null) throw new IllegalArgumentException("Provider 不存在: " + id);
        llmProviderMapper.deleteById(id);
    }

    public List<WorkflowLlmConfig> listWorkflowConfigs() {
        return workflowLlmConfigMapper.selectList(null);
    }

    /**
     * 更新工作流的 LLM 绑定配置，仅更新非 null 字段（PATCH 语义）。
     * workflowType 对应 workflow_llm_configs.workflow_type，由 V1_4 迁移预置，不可动态创建。
     */
    public void updateWorkflowConfig(String workflowType, String providerId, String modelOverride, java.math.BigDecimal temperature) {
        WorkflowLlmConfig wf = workflowLlmConfigMapper.selectOne(
                new LambdaQueryWrapper<WorkflowLlmConfig>()
                        .eq(WorkflowLlmConfig::getWorkflowType, workflowType));
        if (wf == null) throw new IllegalArgumentException("工作流不存在: " + workflowType);
        if (providerId    != null) wf.setProviderId(providerId);
        if (modelOverride != null) wf.setModelOverride(modelOverride);
        if (temperature   != null) wf.setTemperature(temperature);
        workflowLlmConfigMapper.updateById(wf);
    }
}
