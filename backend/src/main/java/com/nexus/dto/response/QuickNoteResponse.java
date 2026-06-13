package com.nexus.dto.response;

import lombok.Data;

/** Quick Note / Memo 写入成功后的响应，包含保存路径和时间。 */
@Data
public class QuickNoteResponse {
    /** 文件绝对路径 */
    private String path;
    /** 相对 Vault 根目录的路径，供前端展示 */
    private String relativePath;
    /** 创建时间，ISO 8601 格式 */
    private String createdAt;
}
