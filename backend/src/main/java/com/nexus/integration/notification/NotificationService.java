package com.nexus.integration.notification;

import java.util.Map;

public interface NotificationService {
    String channel();
    void send(String userId, NotificationEvent event, Map<String, Object> payload);
}
