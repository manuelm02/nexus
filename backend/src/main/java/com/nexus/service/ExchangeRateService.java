package com.nexus.service;

import com.nexus.entity.ExchangeRate;
import com.nexus.integration.exchange.ExchangeRateClient;
import com.nexus.mapper.ExchangeRateMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** 维护 exchange_rates 缓存表：按需刷新过期汇率，供分类支出占比饼图折算多币种使用。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExchangeRateService {

    private static final BigDecimal CNY = BigDecimal.ONE;

    private final ExchangeRateMapper exchangeRateMapper;
    private final ExchangeRateClient exchangeRateClient;

    /**
     * 返回 currencies 中每个币种兑 CNY 的汇率（CNY 固定为 1）。
     * 缓存超过 24 小时或缺失的币种会触发一次实时刷新；刷新失败时回退到已有缓存值（若有），
     * 完全没有缓存且刷新失败的币种不会出现在返回结果中（由调用方在前端标记为"未计入"）。
     */
    public Map<String, BigDecimal> getRatesToCny(Set<String> currencies) {
        Map<String, BigDecimal> result = new HashMap<>();
        result.put("CNY", CNY);

        Set<String> foreign = currencies.stream().filter(c -> c != null && !"CNY".equals(c)).collect(Collectors.toSet());
        if (foreign.isEmpty()) return result;

        Map<String, ExchangeRate> cached = exchangeRateMapper.selectBatchIds(foreign).stream()
                .collect(Collectors.toMap(ExchangeRate::getCurrency, e -> e));

        LocalDateTime staleThreshold = LocalDateTime.now().minusHours(24);
        Set<String> stale = foreign.stream()
                .filter(c -> !cached.containsKey(c) || cached.get(c).getUpdatedAt().isBefore(staleThreshold))
                .collect(Collectors.toSet());

        if (!stale.isEmpty()) {
            try {
                Map<String, BigDecimal> fresh = exchangeRateClient.fetchRatesToCny(stale);
                fresh.forEach((currency, rate) -> upsert(currency, rate, cached));
            } catch (Exception e) {
                log.warn("汇率刷新失败，使用缓存值（如有）: {}", e.getMessage());
            }
        }

        cached.forEach((currency, entity) -> result.put(currency, entity.getRateToCny()));
        return result;
    }

    /** 定时任务调用：强制刷新所有当前使用中的币种汇率，不判断是否过期。 */
    public void refreshAll(Set<String> currencies) {
        Set<String> foreign = currencies.stream().filter(c -> c != null && !"CNY".equals(c)).collect(Collectors.toSet());
        if (foreign.isEmpty()) return;
        Map<String, ExchangeRate> cached = exchangeRateMapper.selectBatchIds(foreign).stream()
                .collect(Collectors.toMap(ExchangeRate::getCurrency, e -> e));
        Map<String, BigDecimal> fresh = exchangeRateClient.fetchRatesToCny(foreign);
        fresh.forEach((currency, rate) -> upsert(currency, rate, cached));
    }

    private void upsert(String currency, BigDecimal rate, Map<String, ExchangeRate> cached) {
        ExchangeRate entity = cached.get(currency);
        if (entity == null) {
            entity = new ExchangeRate();
            entity.setCurrency(currency);
        }
        entity.setRateToCny(rate);
        entity.setUpdatedAt(LocalDateTime.now());
        if (cached.containsKey(currency)) {
            exchangeRateMapper.updateById(entity);
        } else {
            exchangeRateMapper.insert(entity);
            cached.put(currency, entity);
        }
    }
}
