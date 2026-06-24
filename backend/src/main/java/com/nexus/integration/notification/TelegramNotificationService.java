package com.nexus.integration.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Service
public class TelegramNotificationService implements NotificationService {

    @Value("${telegram.bot-token:}")
    private String botToken;

    @Value("${telegram.admin-chat-id:}")
    private String adminChatId;

    @Override
    public String channel() {
        return "telegram";
    }

    @Override
    public void send(String userId, NotificationEvent event, Map<String, Object> payload) {
        if (botToken.isBlank() || adminChatId.isBlank()) {
            log.debug("Telegram 未配置，跳过通知");
            return;
        }
        String text = formatMessage(event, payload);
        try {
            String chatId = userId != null ? userId : adminChatId;
            String url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
            WebClient.create().post()
                    .uri(url)
                    .bodyValue(Map.of("chat_id", chatId, "text", text, "parse_mode", "HTML"))
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();
        } catch (Exception e) {
            log.error("Telegram 发送失败: {}", e.getMessage());
        }
    }

    private String formatMessage(NotificationEvent event, Map<String, Object> payload) {
        return switch (event) {
            case SUBSCRIPTION_EXPIRING -> String.format(
                    "⚠️ <b>订阅即将到期</b>\n%s 将在 %s 天后到期（%s）",
                    payload.get("name"), payload.get("days_left"), payload.get("expire_date"));
            case API_KEY_PLAN_EXPIRING -> String.format(
                    "⚠️ <b>API Key 套餐即将到期</b>\n%s 将在 %s 天后到期（%s）",
                    payload.get("name"), payload.get("days_left"), payload.get("expire_date"));
            case API_KEY_LOW_BALANCE -> String.format(
                    "💰 <b>API Key 余额不足</b>\n%s 余额 %s，低于阈值 %s",
                    payload.get("name"), payload.get("remaining_balance"), payload.get("threshold"));
            case CREDENTIAL_EXPIRING -> String.format(
                    "🔑 <b>凭证即将到期</b>\n%s（%s）将在 %s 天后到期（%s）",
                    payload.get("platform"), payload.get("label"), payload.get("days_left"), payload.get("expire_date"));
            case TASK_COMPLETED -> String.format("✅ 任务完成");
            default -> event.name() + ": " + payload;
        };
    }
}
