package com.nexus.translate;

/** TencentMachineTranslationClient 封装腾讯云 SDK 调用，避免业务逻辑直接依赖外部网络实现。 */
public interface TencentMachineTranslationClient {

    /**
     * 使用腾讯云机器翻译生成译文。
     *
     * @param secretId 腾讯云 SecretId
     * @param secretKey 腾讯云 SecretKey
     * @param sourceText 原文
     * @param targetLanguage 腾讯云目标语言代码
     * @return 腾讯云返回的译文
     */
    String translate(String secretId, String secretKey, String sourceText, String targetLanguage) throws Exception;
}
