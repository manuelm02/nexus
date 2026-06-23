package com.nexus.controller;

import com.nexus.dto.request.SubscriptionCategorySuggestRequest;
import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.SubscriptionResponse;
import com.nexus.dto.response.SubscriptionStatsResponse;
import com.nexus.dto.response.SubscriptionCategorySuggestResponse;
import com.nexus.service.ExchangeRateService;
import com.nexus.service.SubscriptionCategoryAiService;
import com.nexus.service.SubscriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Subscriptions 订阅信息接口，保留 /ledger 旧路径用于兼容已有客户端。 */
@RestController
@RequestMapping({"/api/v1/subscriptions", "/api/v1/ledger"})
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptionService;
    private final SubscriptionCategoryAiService categoryAiService;
    private final ExchangeRateService exchangeRateService;

    @GetMapping
    public ApiResponse<List<SubscriptionResponse>> list() {
        return ApiResponse.ok(subscriptionService.list());
    }

    @PostMapping
    public ApiResponse<SubscriptionResponse> create(@Valid @RequestBody SubscriptionCreateRequest req) {
        return ApiResponse.ok(subscriptionService.create(req));
    }

    /**
     * 订阅统计：按币种分组的 activeCount / monthlyTotal / yearlyTotal / dueThisMonth。
     * 静态路径，Spring 优先匹配，不会被 /{id} 误捕获。
     */
    @GetMapping("/stats")
    public ApiResponse<SubscriptionStatsResponse> stats() {
        return ApiResponse.ok(subscriptionService.stats());
    }

    /** 当前订阅涉及的各币种兑 CNY 实时汇率，供分类支出占比饼图折算使用。 */
    @GetMapping("/exchange-rates")
    public ApiResponse<Map<String, BigDecimal>> exchangeRates() {
        return ApiResponse.ok(exchangeRateService.getRatesToCny(subscriptionService.distinctActiveCurrencies()));
    }

    /**
     * AI 分类识别：根据订阅名称在现有分类中选择或生成新分类。
     */
    @PostMapping("/category-suggest")
    public ApiResponse<SubscriptionCategorySuggestResponse> suggestCategory(
            @Valid @RequestBody SubscriptionCategorySuggestRequest req) {
        return ApiResponse.ok(categoryAiService.suggest(req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<SubscriptionResponse> update(@PathVariable String id,
                                                    @RequestBody SubscriptionUpdateRequest req) {
        return ApiResponse.ok(subscriptionService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        subscriptionService.delete(id);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}/usage")
    public ApiResponse<SubscriptionResponse> updateUsage(@PathVariable String id,
                                                          @Valid @RequestBody SubscriptionUsageRequest req) {
        return ApiResponse.ok(subscriptionService.updateUsage(id, req));
    }
}
