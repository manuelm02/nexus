package com.nexus.controller;

import com.nexus.config.SystemConfigKeys;
import com.nexus.dto.request.SubscriptionSettingsUpdateRequest;
import com.nexus.service.LlmConfigService;
import com.nexus.service.SystemConfigService;
import com.nexus.service.InboxSettingsService;
import com.nexus.service.PaperlessGatewayService;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettingsControllerTest {

    @Mock
    private LlmConfigService llmConfigService;
    @Mock
    private SystemConfigService systemConfigService;
    @Mock
    private InboxSettingsService inboxSettingsService;
    @Mock
    private PaperlessGatewayService paperlessGatewayService;

    @InjectMocks
    private SettingsController settingsController;

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    // ==================== 订阅提醒设置 ====================

    @Test
    void getSubscriptionSettingsShouldReturnDefault7WhenNotConfigured() {
        when(systemConfigService.get(SystemConfigKeys.SUBSCRIPTION_NOTIFY_DAYS_BEFORE)).thenReturn(null);

        var resp = settingsController.getSubscriptionSettings();

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData().getNotifyDaysBefore()).isEqualTo(7);
    }

    @Test
    void getSubscriptionSettingsShouldReturnConfiguredValue() {
        when(systemConfigService.get(SystemConfigKeys.SUBSCRIPTION_NOTIFY_DAYS_BEFORE)).thenReturn("14");

        var resp = settingsController.getSubscriptionSettings();

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData().getNotifyDaysBefore()).isEqualTo(14);
    }

    @Test
    void saveSubscriptionSettingsShouldPersistAndReturnUpdatedValue() {
        // getSubscriptionSettings 内部调用 get() 读取已保存的值
        when(systemConfigService.get(SystemConfigKeys.SUBSCRIPTION_NOTIFY_DAYS_BEFORE)).thenReturn("14");

        var req = new SubscriptionSettingsUpdateRequest();
        req.setNotifyDaysBefore(14);

        var resp = settingsController.saveSubscriptionSettings(req);

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData().getNotifyDaysBefore()).isEqualTo(14);
    }

    @Test
    void getSubscriptionSettingsShouldReturnDefaultWhenBlank() {
        // 系统不会有意存入空串，但防御性返回默认值
        when(systemConfigService.get(SystemConfigKeys.SUBSCRIPTION_NOTIFY_DAYS_BEFORE)).thenReturn("");

        var resp = settingsController.getSubscriptionSettings();

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData().getNotifyDaysBefore()).isEqualTo(7);
    }

    @Test
    void subscriptionSettingsValidationShouldRejectMissingNotifyDays() {
        var req = new SubscriptionSettingsUpdateRequest();

        var violations = validator.validate(req);

        assertThat(violations)
                .anySatisfy(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("notifyDaysBefore"));
    }

    @Test
    void subscriptionSettingsValidationShouldRejectOutOfRangeNotifyDays() {
        var tooSmall = new SubscriptionSettingsUpdateRequest();
        tooSmall.setNotifyDaysBefore(0);
        var tooLarge = new SubscriptionSettingsUpdateRequest();
        tooLarge.setNotifyDaysBefore(91);

        assertThat(validator.validate(tooSmall))
                .anySatisfy(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("notifyDaysBefore"));
        assertThat(validator.validate(tooLarge))
                .anySatisfy(v -> assertThat(v.getPropertyPath().toString()).isEqualTo("notifyDaysBefore"));
    }
}
