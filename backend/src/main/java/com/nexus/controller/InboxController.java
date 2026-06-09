package com.nexus.controller;

import com.nexus.dto.request.InboxCreateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.InboxItem;
import com.nexus.service.InboxService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Inbox 信息收纳接口，保留 /fleeting 旧路径用于兼容已有客户端。 */
@RestController
@RequestMapping({"/api/v1/inbox", "/api/v1/fleeting"})
@RequiredArgsConstructor
public class InboxController {

    private final InboxService inboxService;

    @GetMapping
    public ApiResponse<List<InboxItem>> list() {
        return ApiResponse.ok(inboxService.list());
    }

    @PostMapping
    public ApiResponse<InboxItem> create(@Valid @RequestBody InboxCreateRequest req) {
        return ApiResponse.ok(inboxService.create(req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        inboxService.delete(id);
        return ApiResponse.ok();
    }
}
