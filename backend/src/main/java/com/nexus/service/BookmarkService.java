package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nexus.dto.request.BookmarkCreateRequest;
import com.nexus.dto.request.BookmarkListRequest;
import com.nexus.dto.request.BookmarkUpdateRequest;
import com.nexus.dto.response.BookmarkResponse;
import com.nexus.dto.response.BookmarkTagSummaryResponse;
import com.nexus.entity.Bookmark;
import com.nexus.mapper.BookmarkMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 书签核心业务服务，提供 CRUD、搜索、标签筛选、未读/归档切换功能。
 * 书签为 Nexus 原生数据，存储于 PostgreSQL，不依赖任何外部书签服务。
 */
@Service
@RequiredArgsConstructor
public class BookmarkService {

    private final BookmarkMapper bookmarkMapper;
    private final LlmConfigService llmConfigService;

    /**
     * 分页查询书签列表，支持多条件组合筛选。
     *
     * @param req 包含 q/tag/archived/unread/page/size 等筛选参数
     * @return 分页后的 BookmarkResponse 封装
     */
    public Page<BookmarkResponse> list(BookmarkListRequest req) {
        LambdaQueryWrapper<Bookmark> q = new LambdaQueryWrapper<>();

        // 关键词搜索：title / url / description / notes，以及 JSONB tags 文本匹配
        if (req.getQ() != null && !req.getQ().isBlank()) {
            String keyword = "%" + req.getQ() + "%";
            q.and(w -> w
                    .like(Bookmark::getTitle, keyword)
                    .or().like(Bookmark::getUrl, keyword)
                    .or().like(Bookmark::getDescription, keyword)
                    .or().like(Bookmark::getNotes, keyword)
                    // PostgreSQL JSONB tags 列转文本后做 LIKE 匹配
                    .or().apply("tags::text ILIKE {0}", keyword));
        }

        // 标签精确筛选：JSONB @> 操作符检查数组中是否包含指定标签
        if (req.getTag() != null && !req.getTag().isBlank()) {
            q.apply("tags @> {0}::jsonb", "[\"" + req.getTag().replace("\"", "\\\"") + "\"]");
        }

        if (req.getArchived() != null) {
            q.eq(Bookmark::isArchived, req.getArchived());
        }
        if (req.getUnread() != null) {
            q.eq(Bookmark::isUnread, req.getUnread());
        }

        q.orderByDesc(Bookmark::getCreatedAt);

        Page<Bookmark> page = new Page<>(req.getPage() != null ? req.getPage() : 1,
                req.getSize() != null ? req.getSize() : 20);
        Page<Bookmark> result = bookmarkMapper.selectPage(page, q);

        // 转换为响应对象，运行时计算 domain
        List<BookmarkResponse> records = result.getRecords().stream()
                .map(BookmarkResponse::from)
                .collect(Collectors.toList());

        Page<BookmarkResponse> responsePage = new Page<>(result.getCurrent(), result.getSize(), result.getTotal());
        responsePage.setRecords(records);
        return responsePage;
    }

    /**
     * 创建书签。
     * 校验 URL 格式，生成 normalized_url，处理标题兜底和标签去重，
     * 检查 normalized_url 唯一性防止重复添加。
     *
     * @param req 包含必填 URL 和可选标题/描述/备注/标签
     * @return 创建后的 BookmarkResponse
     * @throws IllegalArgumentException URL 格式无效或书签已存在
     */
    public BookmarkResponse create(BookmarkCreateRequest req) {
        String url = req.getUrl().trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new IllegalArgumentException("URL 必须以 http:// 或 https:// 开头");
        }

        String normalized = normalizeUrl(url);

        // 检查 exact URL 唯一性
        Bookmark existing = bookmarkMapper.selectOne(
                new LambdaQueryWrapper<Bookmark>().eq(Bookmark::getNormalizedUrl, normalized));
        if (existing != null) {
            throw new IllegalArgumentException("该书签已存在");
        }

        Bookmark b = new Bookmark();
        b.setUrl(url);
        b.setNormalizedUrl(normalized);
        b.setTitle(req.getTitle() != null && !req.getTitle().isBlank() ? req.getTitle().trim() : extractDomainFallback(url));
        b.setDescription(req.getDescription());
        b.setNotes(req.getNotes());
        b.setTags(normalizeTags(req.getTags()));
        b.setUnread(true);
        b.setArchived(false);

        bookmarkMapper.insert(b);
        return BookmarkResponse.from(b);
    }

    /**
     * 局部更新书签字段。
     * 支持更新标题、描述、备注、标签、未读状态、归档状态。
     * URL 不支持修改——如需修改 URL，应删除后重新创建。
     *
     * @param id  书签 ID
     * @param req 需要更新的字段，null 表示保持不变
     * @return 更新后的 BookmarkResponse
     * @throws IllegalArgumentException 书签不存在
     */
    public BookmarkResponse update(String id, BookmarkUpdateRequest req) {
        Bookmark b = getOrThrow(id);

        // 用 UpdateWrapper 排除 null 字段，避免覆盖已有值；清空/切换值时显式 SET
        UpdateWrapper<Bookmark> update = new UpdateWrapper<Bookmark>().eq("id", id);

        if (req.getTitle() != null) {
            update.set("title", req.getTitle().isBlank() ? null : req.getTitle().trim());
        }
        if (req.getDescription() != null) {
            update.set("description", req.getDescription().isBlank() ? null : req.getDescription().trim());
        }
        if (req.getNotes() != null) {
            update.set("notes", req.getNotes().isBlank() ? null : req.getNotes().trim());
        }
        if (req.getTags() != null) {
            // JSONB 类型字段必须传入 JSON 字符串，JacksonTypeHandler 无法自动处理 UpdateWrapper
            List<String> tags = normalizeTags(req.getTags());
            update.setSql("tags = '" + toJsonArray(tags) + "'::jsonb");
        }
        if (req.getUnread() != null) {
            update.set("unread", req.getUnread());
        }
        if (req.getArchived() != null) {
            update.set("archived", req.getArchived());
        }

        bookmarkMapper.update(null, update);
        // 重新查询以获取最新数据
        return BookmarkResponse.from(getOrThrow(id));
    }

    /**
     * 硬删除书签。前端需做二次确认。
     *
     * @param id 书签 ID
     * @throws IllegalArgumentException 书签不存在
     */
    public void delete(String id) {
        getOrThrow(id);
        bookmarkMapper.deleteById(id);
    }

    private Bookmark getOrThrow(String id) {
        Bookmark b = bookmarkMapper.selectById(id);
        if (b == null) throw new IllegalArgumentException("书签不存在: " + id);
        return b;
    }

    /**
     * URL 标准化：trim + 去除末尾 /，不做复杂的 canonicalize。
     * 第一版 exact URL unique 即可。
     */
    private String normalizeUrl(String url) {
        String trimmed = url.trim();
        // 移除末尾单个斜杠（保留 http:// 后的 //）
        if (trimmed.endsWith("/") && !trimmed.equals("http://") && !trimmed.equals("https://")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    /**
     * 从 URL 中提取域名作为标题兜底。
     * 解析失败时返回原始 URL。
     */
    private String extractDomainFallback(String url) {
        try {
            java.net.URI uri = new java.net.URI(url);
            String host = uri.getHost();
            return host != null ? host : url;
        } catch (Exception e) {
            return url;
        }
    }

    /**
     * 标签标准化：trim、过滤空字符串、去重。
     * 保持插入顺序，不做排序。
     */
    private List<String> normalizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) return Collections.emptyList();
        return tags.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.toList());
    }

    /**
     * 将标签列表转换为 PostgreSQL JSON 数组字符串。
     * 简单拼接避免引入 Jackson 依赖，标签字符串已做 trim + 去重处理，不包含引号。
     */
    private String toJsonArray(List<String> tags) {
        if (tags == null || tags.isEmpty()) return "[]";
        return tags.stream()
                .map(t -> "\"" + t.replace("\\", "\\\\").replace("\"", "\\\"") + "\"")
                .collect(Collectors.joining(",", "[", "]"));
    }

    /**
     * 获取所有标签及其出现次数，用于标签工作台展示。
     *
     * @return 标签汇总响应，包含每个标签及其对应的书签数量
     */
    public BookmarkTagSummaryResponse getTagSummary() {
        List<Bookmark> all = bookmarkMapper.selectList(null);
        Map<String, Long> counts = all.stream()
                .filter(b -> b.getTags() != null)
                .flatMap(b -> b.getTags().stream())
                .filter(t -> !t.isBlank())
                .collect(Collectors.groupingBy(t -> t, Collectors.counting()));

        BookmarkTagSummaryResponse resp = new BookmarkTagSummaryResponse();
        List<BookmarkTagSummaryResponse.TagInfo> tags = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> {
                    BookmarkTagSummaryResponse.TagInfo info = new BookmarkTagSummaryResponse.TagInfo();
                    info.setName(entry.getKey());
                    info.setCount(entry.getValue().intValue());
                    return info;
                }).toList();
        resp.setTags(tags);
        return resp;
    }

    /**
     * AI 驱动的标签合并建议（advisory，不自动合并）。
     * LLM 不可用时返回空标签列表。
     */
    public BookmarkTagSummaryResponse suggestTagCleanup() {
        BookmarkTagSummaryResponse resp = new BookmarkTagSummaryResponse();
        resp.setTags(java.util.Collections.emptyList());

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            // 后续版本可加入 AI 分析逻辑
        } catch (Exception ignored) {
            // LLM 不可用，返回空
        }

        return resp;
    }
}
