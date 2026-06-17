package com.nexus.integration.balance;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 调用 DeepSeek 官方余额接口 GET /user/balance。
 * 响应结构：{"is_available": bool, "balance_infos": [{"currency": "CNY", "total_balance": "100.00", ...}]}
 * DeepSeek 不提供按 token 的用量明细接口，这里只能获取余额，token 消耗仍依赖用户在卡片里手动记录。
 */
@Slf4j
@Component
public class DeepSeekBalanceClient {

    private static final String BASE_URL = "https://api.deepseek.com";

    @SuppressWarnings("unchecked")
    public ProviderBalanceResult fetchBalance(String apiKey) {
        Map<String, Object> body = WebClient.create(BASE_URL).get()
                .uri("/user/balance")
                .header("Authorization", "Bearer " + apiKey)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(10))
                .block();

        if (body == null || !Boolean.TRUE.equals(body.get("is_available"))) {
            throw new IllegalStateException("DeepSeek 账户当前不可用或 API Key 无效");
        }

        List<Map<String, Object>> infos = (List<Map<String, Object>>) body.get("balance_infos");
        if (infos == null || infos.isEmpty()) {
            throw new IllegalStateException("DeepSeek 余额接口未返回数据");
        }

        Map<String, Object> primary = infos.get(0);
        BigDecimal balance = new BigDecimal(String.valueOf(primary.get("total_balance")));
        String currency = String.valueOf(primary.get("currency"));
        return new ProviderBalanceResult(balance, currency, body);
    }
}
