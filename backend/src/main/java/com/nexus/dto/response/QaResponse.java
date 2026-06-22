package com.nexus.dto.response;

import java.util.List;

/** Mindbank Q&A 问答响应 */
public record QaResponse(String answer, List<String> sources) {}
