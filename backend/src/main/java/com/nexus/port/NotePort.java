package com.nexus.port;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Obsidian vault 笔记读写端口，供 Pipeline（Step4 写 Master/Session Note）和 Agent（巡检读笔记）共用。
 * 与 NotesService（前端 Notes 页面的任意文件 CRUD）职责不同：NotePort 专注 Mindbank 的
 * Master Note / Session Note / _index 索引三类结构化操作，不处理任意文件的浏览编辑。
 *
 * 文件命名约定：
 * - Master Note：{workspaceSafeName}__master.md
 * - Session Note：{workspaceSafeName}__session__{date}.md
 * - 索引：{subFolder}/_index.md
 */
public interface NotePort {

    /**
     * 读取指定 workspace 的 Master Note 全文。
     *
     * @param workspaceName workspace 名称（用作文件名前缀）
     * @return Master Note 内容；文件不存在时返回 null
     */
    String readMaster(String workspaceName);

    /**
     * 覆盖写入 Master Note。自动创建 {vault}/{subFolder}/ 目录。
     * 文件命名：{workspaceSafeName}__master.md
     *
     * @param workspaceName workspace 名称
     * @param subFolder     相对 vault 根的子文件夹（如 "Mindbank"），用于在 vault 中组织 Mindbank 笔记
     * @param content       Markdown 文本
     */
    void writeMaster(String workspaceName, String subFolder, String content);

    /**
     * 追加 Session Note（每次导入一个新文件创建一个）。
     * 文件命名：{workspaceSafeName}__session__{date}.md；若同名文件已存在，追加序号后缀避免覆盖。
     *
     * @param workspaceName workspace 名称
     * @param subFolder     相对 vault 根的子文件夹
     * @param content       Markdown 文本
     * @param date          用于文件名的日期字符串（如 "2026-06-17"）
     */
    void appendSession(String workspaceName, String subFolder, String content, String date);

    /**
     * 列出 vault 中所有 .md 文件的元信息，供 Agent 巡检判断。
     * 递归扫描，过滤 .obsidian 等隐藏目录。
     */
    List<NoteMeta> listNotes();

    /**
     * 读取 {subFolder}/_index.md 全文。
     *
     * @param subFolder 相对 vault 根的子文件夹
     * @return 索引文件内容；不存在时返回空字符串（不抛异常）
     */
    String readIndex(String subFolder);

    /**
     * 向 {subFolder}/_index.md 追加一行条目。文件不存在时创建并写入标题。
     *
     * @param subFolder 相对 vault 根的子文件夹
     * @param entry     一行索引条目（不含换行）
     */
    void appendIndex(String subFolder, String entry);

    /**
     * 覆盖写入 {subFolder}/_index.md 完整内容，用于 fix_index 建议执行时修正索引。
     * 文件不存在则创建，存在则截断后写入新内容。
     *
     * @param subFolder 相对 vault 根的子文件夹
     * @param content   完整的索引 Markdown 内容
     */
    void writeIndex(String subFolder, String content);

    /**
     * 将 vault 内的笔记移动到归档目录。实现方必须校验 sourceRelativePath 不能逃逸 vault 根路径。
     *
     * @param sourceRelativePath vault 内相对路径
     * @param archiveFolder      vault 内归档目录名，例如 "_archive"
     * @return 归档后的 vault 内相对路径
     */
    String archiveNote(String sourceRelativePath, String archiveFolder);

    /**
     * Obsidian 笔记元信息，用于 Agent 巡检判断。
     *
     * @param name         文件名（含扩展名）
     * @param path         相对 vault 根的路径
     * @param sizeBytes    文件大小（字节）
     * @param lastModified 最后修改时间
     */
    record NoteMeta(String name, String path, long sizeBytes, LocalDateTime lastModified) {}
}
