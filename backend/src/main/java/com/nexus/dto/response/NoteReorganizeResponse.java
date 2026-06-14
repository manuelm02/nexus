package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 笔记标签整理结果。 */
@Data
public class NoteReorganizeResponse {
    /** 本次扫描到的笔记总数 */
    private int scannedCount;
    /** 标签发生变化并已移动的笔记列表 */
    private List<NoteReorganizeChange> changes;
    /** AI 不可用时为 true，此时不执行任何变更，changes 为空 */
    private boolean aiUnavailable;

    @Data
    public static class NoteReorganizeChange {
        private String title;
        private String oldTag;
        private String newTag;
        /** 相对 Vault 的旧路径 */
        private String oldPath;
        /** 相对 Vault 的新路径 */
        private String newPath;
    }
}
