package com.nexus.controller;

import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.SubscriptionResponse;
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

    /**
     * 查询所有订阅。
     *
     * @return 不含 api_* 休眠字段的订阅列表
     */
    @GetMapping
    public ApiResponse<List<SubscriptionResponse>> list() {
        return ApiResponse.ok(subscriptionService.list());
    }

    /**
     * 创建订阅。
     *
     * @param req 创建请求，名称必填
     * @return 创建后的订阅响应
     */
    @PostMapping
    public ApiResponse<SubscriptionResponse> create(@Valid @RequestBody SubscriptionCreateRequest req) {
        return ApiResponse.ok(subscriptionService.create(req));
    }

    /**
     * 更新订阅。
     *
     * @param id 订阅 ID
     * @param req 更新请求，null 字段表示不修改
     * @return 更新后的订阅响应
     */
    @PatchMapping("/{id}")
    public ApiResponse<SubscriptionResponse> update(@PathVariable String id,
                                                    @RequestBody SubscriptionUpdateRequest req) {
        return ApiResponse.ok(subscriptionService.update(id, req));
    }

    /**
     * 删除订阅。
     *
     * @param id 订阅 ID
     * @return 空响应
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        subscriptionService.delete(id);
        return ApiResponse.ok();
    }

    /**
     * 手动更新订阅用量。
     *
     * @param id 订阅 ID
     * @param req 当前用量请求
     * @return 更新后的订阅响应
     */
    @PatchMapping("/{id}/usage")
    public ApiResponse<SubscriptionResponse> updateUsage(@PathVariable String id,
                                                         @Valid @RequestBody SubscriptionUsageRequest req) {
        return ApiResponse.ok(subscriptionService.updateUsage(id, req));
    }
}
