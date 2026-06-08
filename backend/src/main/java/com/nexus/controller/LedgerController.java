package com.nexus.controller;

import com.nexus.dto.request.LedgerCreateRequest;
import com.nexus.dto.request.LedgerUpdateRequest;
import com.nexus.dto.request.LedgerUsageRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.Ledger;
import com.nexus.service.LedgerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ledger")
@RequiredArgsConstructor
public class LedgerController {

    private final LedgerService ledgerService;

    @GetMapping
    public ApiResponse<List<Ledger>> list() {
        return ApiResponse.ok(ledgerService.list());
    }

    @PostMapping
    public ApiResponse<Ledger> create(@Valid @RequestBody LedgerCreateRequest req) {
        return ApiResponse.ok(ledgerService.create(req));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Ledger> update(@PathVariable String id,
                                      @RequestBody LedgerUpdateRequest req) {
        return ApiResponse.ok(ledgerService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        ledgerService.delete(id);
        return ApiResponse.ok();
    }

    @PatchMapping("/{id}/usage")
    public ApiResponse<Ledger> updateUsage(@PathVariable String id,
                                           @Valid @RequestBody LedgerUsageRequest req) {
        return ApiResponse.ok(ledgerService.updateUsage(id, req));
    }
}
