package com.nexus.controller;

import com.nexus.dto.request.FleetingCreateRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.Fleeting;
import com.nexus.service.FleetingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/fleeting")
@RequiredArgsConstructor
public class FleetingController {

    private final FleetingService fleetingService;

    @GetMapping
    public ApiResponse<List<Fleeting>> list() {
        return ApiResponse.ok(fleetingService.list());
    }

    @PostMapping
    public ApiResponse<Fleeting> create(@Valid @RequestBody FleetingCreateRequest req) {
        return ApiResponse.ok(fleetingService.create(req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        fleetingService.delete(id);
        return ApiResponse.ok();
    }
}
