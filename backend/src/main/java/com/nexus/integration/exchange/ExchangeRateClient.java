package com.nexus.integration.exchange;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * 调用 Frankfurter 汇率 API（https://api.frankfurter.dev，免费、无需 API Key，基于欧洲央行数据，每个工作日更新）。
 * 接口返回"1 CNY = X <currency>"，需取倒数得到"1 <currency> = Y CNY"。
 */
@Slf4j
@Component
public class ExchangeRateClient {

    private static final String BASE_URL = "https://api.frankfurter.dev";

    @SuppressWarnings("unchecked")
    public Map<String, BigDecimal> fetchRatesToCny(Set<String> currencies) {
        if (currencies.isEmpty()) return Map.of();
        String symbols = String.join(",", currencies);

        Map<String, Object> body = WebClient.create(BASE_URL).get()
                .uri("/v1/latest?base=CNY&symbols=" + symbols)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(10))
                .block();

        if (body == null || body.get("rates") == null) {
            throw new IllegalStateException("汇率接口未返回数据");
        }

        Map<String, Object> rates = (Map<String, Object>) body.get("rates");
        Map<String, BigDecimal> result = new HashMap<>();
        rates.forEach((currency, value) -> {
            BigDecimal rateFromCny = new BigDecimal(String.valueOf(value));
            if (rateFromCny.signum() > 0) {
                // 1 CNY = rateFromCny <currency>  =>  1 <currency> = 1/rateFromCny CNY
                result.put(currency, BigDecimal.ONE.divide(rateFromCny, 6, RoundingMode.HALF_UP));
            }
        });
        return result;
    }
}
