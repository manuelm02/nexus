package com.nexus.dto.request;

import lombok.Data;

import java.util.List;

@Data
public class NotificationConfigUpdateRequest {
    private List<ChannelConfig> configs;

    @Data
    public static class ChannelConfig {
        private String channel;
        private String eventType;
        private boolean enabled;
    }
}
