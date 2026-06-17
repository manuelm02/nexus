package com.nexus.controller;

import com.nexus.dto.request.SubscriptionCategoryCreateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.SubscriptionCategoryResponse;
import com.nexus.service.SubscriptionCategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 订阅分类管理接口：增删查。 */
@RestController
@RequestMapping("/api/v1/subscription-categories")
@RequiredArgsConstructor
public class SubscriptionCategoryController {

    private final SubscriptionCategoryService categoryService;

    @GetMapping
    public ApiResponse<List<SubscriptionCategoryResponse>> list() {
        return ApiResponse.ok(categoryService.list());
    }

    @PostMapping
    public ApiResponse<SubscriptionCategoryResponse> create(
            @Valid @RequestBody SubscriptionCategoryCreateRequest req) {
        return ApiResponse.ok(categoryService.create(req.getName()));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        categoryService.delete(id);
        return ApiResponse.ok();
    }
}
