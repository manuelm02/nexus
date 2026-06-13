package com.nexus.inbox.note;

import com.nexus.dto.request.QuickNoteRequest;
import com.nexus.dto.response.QuickNoteResponse;

/**
 * 笔记写入端口——定义 Nexus 将 Quick Note / Memo 写入外部笔记系统的契约。
 * 当前实现为 Obsidian Vault Markdown 文件写入，未来可扩展其他笔记后端。
 */
public interface NoteSinkPort {

    /**
     * 将笔记内容写入外部笔记系统。
     *
     * @param req 包含 content（必填）、title（可选）、kind（quick_note/memo）、tags（可选）
     * @return 写入成功后的文件路径和元数据
     * @throws IllegalStateException 外部系统未配置
     * @throws IllegalArgumentException content 为空
     */
    QuickNoteResponse write(QuickNoteRequest req);
}
