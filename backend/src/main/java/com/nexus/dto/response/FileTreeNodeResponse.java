package com.nexus.dto.response;

import java.util.List;

import lombok.Data;

/**
 * 文件树节点，对应 vault 中的目录或 .md 文件。
 * 递归结构，folder 类型才有 children，file 类型 children 为 null。
 */
@Data
public class FileTreeNodeResponse {
    /** 显示名（文件名或目录名） */
    private String name;
    /** 相对于 vault 根路径的相对路径，用作前端操作的唯一标识 */
    private String path;
    /** "file" 或 "folder" */
    private String type;
    /** 子节点列表，仅 folder 类型有值 */
    private List<FileTreeNodeResponse> children;
}
