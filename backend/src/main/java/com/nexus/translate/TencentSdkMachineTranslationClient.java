package com.nexus.translate;

import com.tencentcloudapi.common.Credential;
import com.tencentcloudapi.common.profile.ClientProfile;
import com.tencentcloudapi.common.profile.HttpProfile;
import com.tencentcloudapi.tmt.v20180321.TmtClient;
import com.tencentcloudapi.tmt.v20180321.models.TextTranslateRequest;
import com.tencentcloudapi.tmt.v20180321.models.TextTranslateResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** TencentSdkMachineTranslationClient 使用官方 Java SDK 调用腾讯云机器翻译。 */
@Component
public class TencentSdkMachineTranslationClient implements TencentMachineTranslationClient {

    private final String region;

    public TencentSdkMachineTranslationClient(@Value("${nexus.translate.tencent.region:ap-guangzhou}") String region) {
        this.region = region;
    }

    @Override
    public String translate(String secretId, String secretKey, String sourceText, String targetLanguage) throws Exception {
        Credential credential = new Credential(secretId, secretKey);
        HttpProfile httpProfile = new HttpProfile();
        httpProfile.setEndpoint("tmt.tencentcloudapi.com");
        ClientProfile clientProfile = new ClientProfile();
        clientProfile.setHttpProfile(httpProfile);
        TmtClient client = new TmtClient(credential, region, clientProfile);

        TextTranslateRequest request = new TextTranslateRequest();
        request.setSourceText(sourceText);
        request.setSource("auto");
        request.setTarget(targetLanguage);
        request.setProjectId(0L);
        TextTranslateResponse response = client.TextTranslate(request);
        return response.getTargetText();
    }
}
