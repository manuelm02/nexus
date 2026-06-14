package com.nexus.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

/** 书签批量导入确认提交请求，对预览结果逐项做出决策后批量执行。 */
@Data
public class BookmarkImportCommitRequest {
    /** 预览会话标识，与预览响应中的 importSessionId 对应 */
    private String importSessionId;
    @NotEmpty(message = "决策列表不能为空")
    private List<ImportDecision> decisions;

    /** 单条导入决策 */
    @Data
    public static class ImportDecision {
        private int sourceIndex;
        /** 操作类型：create / update / skip */
        private ImportAction action;
        private String finalTitle;
        private List<String> finalTags;
        private String finalDescription;
        /**
         * 是否为 AI 建议的分组确认（非规则自动匹配的分组）
         * 为 true 时才分配 AI 建议的分组
         */
        private boolean acceptSuggestedGroup;
    }

    public enum ImportAction {
        create, update, skip
    }
}
