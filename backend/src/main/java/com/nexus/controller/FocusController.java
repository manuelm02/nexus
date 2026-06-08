package com.nexus.controller;

import com.nexus.dto.request.FocusCreateRequest;
import com.nexus.dto.request.FocusStatusRequest;
import com.nexus.dto.request.FocusUpdateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.Focus;
import com.nexus.service.FocusService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/focus")
@RequiredArgsConstructor
public class FocusController {

    private final FocusService focusService;

    @GetMapping
    public ApiResponse<List<Focus>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(focusService.list(status, date));
    }

    @PostMapping
    public ApiResponse<Focus> create(@Valid @RequestBody FocusCreateRequest req) {
        return ApiResponse.ok(focusService.create(req));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<Focus> updateStatus(@PathVariable String id,
                                           @Valid @RequestBody FocusStatusRequest req) {
        return ApiResponse.ok(focusService.updateStatus(id, req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Focus> update(@PathVariable String id,
                                     @RequestBody FocusUpdateRequest req) {
        return ApiResponse.ok(focusService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        focusService.delete(id);
        return ApiResponse.ok();
    }
}
