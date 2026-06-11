package com.nexus.dto.response;

import java.util.List;

/** HistoryPageResponse 包装后端分页后的翻译历史，供前端解析 total/pages。 */
public record HistoryPageResponse<T>(List<T> items, long total, int page, int size) {}
