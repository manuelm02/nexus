package com.nexus.controller;

import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.Subscription;
import com.nexus.service.SubscriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Subscriptions 订阅信息接口，保留 /ledger 旧路径用于兼容已有客户端。 */
@RestController
@RequestMapping({"/api/v1/subscriptions", "/api/v1/ledger"})
@RequiredArgsConstructor
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    @GetMapping
    public ApiResponse<List<Subscription>> list() {
        return ApiResponse.ok(subscriptionService.list());
    }

    @PostMapping
    public ApiResponse<Subscription> create(@Valid @RequestBody SubscriptionCreateRequest req) {
        return ApiResponse.ok(subscriptionService.create(req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Subscription> update(@PathVariable String id,
                                      @RequestBody SubscriptionUpdateRequest req) {
        return ApiResponse.ok(subscriptionService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        subscriptionService.delete(id);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}/usage")
    public ApiResponse<Subscription> updateUsage(@PathVariable String id,
                                           @Valid @RequestBody SubscriptionUsageRequest req) {
        return ApiResponse.ok(subscriptionService.updateUsage(id, req));
    }
}
