package com.nexus.dto.response;

/**
 * 巡检建议执行结果。采纳建议后由 MindBankSuggestionExecutor 返回，
 * 前端据此展示操作详情或错误信息。
 */
public record SuggestionExecuteResult(boolean success, String message) {}
