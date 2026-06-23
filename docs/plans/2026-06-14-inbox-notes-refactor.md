# Inbox 笔记页面重构：速记/备忘录拆分 + 标签索引 + AI 汇总 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Inbox「笔记」Tab 拆分为对称的「速记」（Quick Note）和「备忘录」（Memo）二级页面，各自维护一份标签索引文件（AI 打标签时复用/新建，单笔记 ≤3 标签），并提供按标题关键词 + 标签筛选的 AI 汇总功能（前端展示 + 复制按钮），同时清理未使用的 consolidate 相关代码。

**Architecture:** 后端新增 `NoteTagIndexService`（读取/写入 Markdown 标签索引文件）、`NoteSummaryService`（替换 `NoteConsolidationService`，按目录扫描 + LLM 汇总）；`NoteAiService` 与 `ObsidianMarkdownWriter` 接入标签索引；`InboxController` 新增 `GET /notes/tags`、`POST /notes/summarize`，删除 consolidate 系列接口。前端新增 `TagPicker`、`NoteSummaryPanel`、`useNoteSection` hook，`NoteComposer` 移除 kind 切换和自由标签输入，`index.tsx`/`InboxDesktopView`/`InboxMobileView` 改为渲染两套对称的速记/备忘录区块。

**Tech Stack:** Spring Boot 3.3.5 + MyBatis-Plus + LangChain4j 0.35.0（后端）；React 18 + TypeScript + TanStack Query + Tailwind v3（前端）。

---

## Task 1: `NoteTagEntryResponse` DTO + `NoteTagIndexService`

**Files:**
- Create: `backend/src/main/java/com/nexus/dto/response/NoteTagEntryResponse.java`
- Create: `backend/src/main/java/com/nexus/service/NoteTagIndexService.java`
- Test: `backend/src/test/java/com/nexus/service/NoteTagIndexServiceTest.java`

- [ ] **Step 1: 创建 `NoteTagEntryResponse` DTO**

```java
package com.nexus.dto.response;

import lombok.Data;

/** 标签索引条目：标签名 + 适用范围说明。 */
@Data
public class NoteTagEntryResponse {
    private String name;
    private String description;
}
```

- [ ] **Step 2: 编写 `NoteTagIndexServiceTest` 失败测试**

```java
package com.nexus.service;

import com.nexus.dto.response.NoteTagEntryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoteTagIndexServiceTest {

    @Mock
    private InboxSettingsService inboxSettingsService;

    private NoteTagIndexService service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        service = new NoteTagIndexService(inboxSettingsService);
        when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(tempDir.toString());
        when(inboxSettingsService.getObsidianTagsDir()).thenReturn("Inbox/tags");
    }

    @Test
    void listTagsShouldReturnEmptyWhenIndexFileMissing() {
        List<NoteTagEntryResponse> tags = service.listTags("quick_note");

        assertThat(tags).isEmpty();
    }

    @Test
    void listTagsShouldParseValidLinesAndSkipInvalidOnes() throws IOException {
        Path indexDir = tempDir.resolve("Inbox/tags");
        Files.createDirectories(indexDir);
        Path indexFile = indexDir.resolve("quick-note-tags.md");
        Files.writeString(indexFile, """
                # Quick Note 标签索引

                - 技术: 编程、工具链、技术学习相关内容
                这是一行格式不规范的内容
                - 生活: 日常生活、习惯、健康相关
                """, StandardCharsets.UTF_8);

        List<NoteTagEntryResponse> tags = service.listTags("quick_note");

        assertThat(tags).hasSize(2);
        assertThat(tags.get(0).getName()).isEqualTo("技术");
        assertThat(tags.get(0).getDescription()).isEqualTo("编程、工具链、技术学习相关内容");
        assertThat(tags.get(1).getName()).isEqualTo("生活");
    }

    @Test
    void syncNewTagsShouldAppendOnlyNewEntriesAndSkipExisting() throws IOException {
        Path indexDir = tempDir.resolve("Inbox/tags");
        Files.createDirectories(indexDir);
        Path indexFile = indexDir.resolve("memo-tags.md");
        Files.writeString(indexFile, "# Memo 标签索引\n\n- 想法: 待孵化的点子和灵感\n", StandardCharsets.UTF_8);

        service.syncNewTags("memo", Map.of(
                "想法", "这个描述不会覆盖已有的",
                "工作", "工作相关的备忘"
        ));

        List<NoteTagEntryResponse> tags = service.listTags("memo");
        assertThat(tags).hasSize(2);
        assertThat(tags.get(0).getDescription()).isEqualTo("待孵化的点子和灵感");
        assertThat(tags.get(1).getName()).isEqualTo("工作");
        assertThat(tags.get(1).getDescription()).isEqualTo("工作相关的备忘");
    }

    @Test
    void syncNewTagsShouldCreateIndexFileWhenMissing() {
        service.syncNewTags("quick_note", Map.of("技术", "编程相关"));

        List<NoteTagEntryResponse> tags = service.listTags("quick_note");
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).getName()).isEqualTo("技术");
        assertThat(tags.get(0).getDescription()).isEqualTo("编程相关");
    }

    @Test
    void syncNewTagsShouldUsePlaceholderWhenDescriptionBlank() {
        service.syncNewTags("quick_note", Map.of("新标签", ""));

        List<NoteTagEntryResponse> tags = service.listTags("quick_note");
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).getDescription()).isEqualTo("（待补充说明）");
    }

    @Test
    void syncNewTagsShouldDoNothingWhenVaultNotConfigured() {
        when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(null);

        service.syncNewTags("quick_note", Map.of("技术", "编程相关"));

        // 不抛异常即可；listTags 同样因 vault 未配置返回空
        assertThat(service.listTags("quick_note")).isEmpty();
    }
}
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend && mvn test -Dtest=NoteTagIndexServiceTest`
Expected: FAIL（编译错误，`NoteTagIndexService` 不存在）

- [ ] **Step 4: 实现 `NoteTagIndexService`**

```java
package com.nexus.service;

import com.nexus.dto.response.NoteTagEntryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 笔记标签索引服务：读取/写入 Quick Note / Memo 各自的标签索引 Markdown 文件，
 * 供 AI 分析时复用标签、前端 TagPicker 拉取可选标签、保存笔记时写回新标签。
 * 索引文件格式为 Markdown 无序列表："- 标签名: 说明"，解析时跳过无法识别的行。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteTagIndexService {

    private final InboxSettingsService inboxSettingsService;

    /** 标签索引行格式："- 标签名: 说明"，冒号前后允许空格 */
    private static final Pattern TAG_LINE_PATTERN = Pattern.compile("^-\\s*([^:]+):\\s*(.+)$");

    /** 标签描述为空时的占位说明，提示后续人工补充 */
    private static final String PLACEHOLDER_DESCRIPTION = "（待补充说明）";

    /**
     * 读取指定笔记类型的标签索引。
     *
     * @param kind 笔记类型：quick_note / memo
     * @return 标签条目列表；索引文件不存在或 Vault 未配置时返回空列表
     */
    public List<NoteTagEntryResponse> listTags(String kind) {
        Path indexPath = resolveIndexPath(kind);
        if (indexPath == null || !Files.exists(indexPath)) {
            return List.of();
        }
        try {
            List<NoteTagEntryResponse> result = new ArrayList<>();
            for (String line : Files.readAllLines(indexPath, StandardCharsets.UTF_8)) {
                Matcher matcher = TAG_LINE_PATTERN.matcher(line.trim());
                if (matcher.matches()) {
                    NoteTagEntryResponse entry = new NoteTagEntryResponse();
                    entry.setName(matcher.group(1).trim());
                    entry.setDescription(matcher.group(2).trim());
                    result.add(entry);
                }
            }
            return result;
        } catch (IOException e) {
            log.warn("读取标签索引失败: {}", e.getMessage());
            return List.of();
        }
    }

    /**
     * 将索引中尚不存在的新标签追加写入索引文件末尾。
     * 已存在的标签跳过，不更新已有说明，避免并发写入覆盖人工/历史信息。
     *
     * @param kind               笔记类型：quick_note / memo
     * @param newTagDescriptions 新标签名 -> 说明；为空时不做任何操作
     */
    public void syncNewTags(String kind, Map<String, String> newTagDescriptions) {
        if (newTagDescriptions == null || newTagDescriptions.isEmpty()) {
            return;
        }
        Path indexPath = resolveIndexPath(kind);
        if (indexPath == null) {
            return;
        }

        Set<String> existingNames = listTags(kind).stream()
                .map(NoteTagEntryResponse::getName)
                .collect(Collectors.toSet());

        StringBuilder toAppend = new StringBuilder();
        for (Map.Entry<String, String> entry : newTagDescriptions.entrySet()) {
            String name = entry.getKey() == null ? "" : entry.getKey().trim();
            if (name.isEmpty() || existingNames.contains(name)) {
                continue;
            }
            String description = entry.getValue() == null || entry.getValue().isBlank()
                    ? PLACEHOLDER_DESCRIPTION : entry.getValue().trim();
            toAppend.append("- ").append(name).append(": ").append(description).append("\n");
            existingNames.add(name);
        }
        if (toAppend.length() == 0) {
            return;
        }

        try {
            if (!Files.exists(indexPath)) {
                Files.createDirectories(indexPath.getParent());
                String title = "memo".equals(kind) ? "Memo" : "Quick Note";
                Files.writeString(indexPath, "# " + title + " 标签索引\n\n", StandardCharsets.UTF_8);
            }
            Files.writeString(indexPath, toAppend.toString(), StandardCharsets.UTF_8, StandardOpenOption.APPEND);
        } catch (IOException e) {
            log.warn("写入标签索引失败: {}", e.getMessage());
        }
    }

    /**
     * 解析标签索引文件路径，并校验在 Vault 范围内（防路径穿越）。
     * Vault 未配置时返回 null，由调用方降级处理。
     */
    private Path resolveIndexPath(String kind) {
        String vaultPath = inboxSettingsService.get("inbox.obsidian.vault_path");
        if (vaultPath == null || vaultPath.isBlank()) {
            return null;
        }
        String tagsDir = inboxSettingsService.getObsidianTagsDir();
        String fileName = "memo".equals(kind) ? "memo-tags.md" : "quick-note-tags.md";

        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path filePath = vaultRoot.resolve(tagsDir).resolve(fileName).normalize().toAbsolutePath();
        if (!filePath.startsWith(vaultRoot)) {
            throw new SecurityException("标签索引路径不在 Obsidian Vault 范围内");
        }
        return filePath;
    }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && mvn test -Dtest=NoteTagIndexServiceTest`
Expected: PASS（6 个测试全部通过）

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/nexus/dto/response/NoteTagEntryResponse.java backend/src/main/java/com/nexus/service/NoteTagIndexService.java backend/src/test/java/com/nexus/service/NoteTagIndexServiceTest.java
git commit -m "feat: 新增笔记标签索引服务 NoteTagIndexService"
```

---

## Task 2: `InboxSettingsService` 标签目录配置 + 移除 Consolidated 目录

**Files:**
- Modify: `backend/src/main/java/com/nexus/service/InboxSettingsService.java`
- Modify: `backend/src/main/java/com/nexus/dto/response/InboxSettingsResponse.java`

- [ ] **Step 1: 修改 `InboxSettingsService` 常量与方法**

在 `backend/src/main/java/com/nexus/service/InboxSettingsService.java` 中，将：

```java
    private static final String DEFAULT_INBOX_DIR = "Inbox";
    private static final String QUICK_NOTE_DIR = "Quick Note";
    private static final String MEMO_DIR = "Memo";
    private static final String CONSOLIDATED_DIR = "Consolidated";
```

替换为：

```java
    private static final String DEFAULT_INBOX_DIR = "Inbox";
    private static final String QUICK_NOTE_DIR = "Quick Note";
    private static final String MEMO_DIR = "Memo";
    private static final String TAGS_DIR = "tags";
```

将 `getSettings()` 中的：

```java
        resp.setObsidianFileNamingPattern(null);
        resp.setObsidianConsolidationDir(resolveChildDir(inboxDir, CONSOLIDATED_DIR));
```

替换为：

```java
        resp.setObsidianFileNamingPattern(null);
```

将：

```java
    /** AI 整理后的固定输出目录。 */
    public String getObsidianConsolidationDir() {
        return resolveChildDir(getObsidianInboxRootDir(), CONSOLIDATED_DIR);
    }
```

替换为：

```java
    /** 标签索引文件固定存放目录。 */
    public String getObsidianTagsDir() {
        return resolveChildDir(getObsidianInboxRootDir(), TAGS_DIR);
    }
```

- [ ] **Step 2: 从 `InboxSettingsResponse` 移除 `obsidianConsolidationDir` 字段**

在 `backend/src/main/java/com/nexus/dto/response/InboxSettingsResponse.java` 中删除：

```java
    private String obsidianConsolidationDir;
```

- [ ] **Step 3: 编译确认**

Run: `cd backend && mvn compile`
Expected: BUILD SUCCESS（暂时会因 `NoteConsolidationService` 等仍引用 `getObsidianConsolidationDir()` 报错——这些引用将在 Task 6 中随旧服务一起删除；若此步报错属预期，记录后继续）

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/nexus/service/InboxSettingsService.java backend/src/main/java/com/nexus/dto/response/InboxSettingsResponse.java
git commit -m "feat: InboxSettingsService 新增标签索引目录配置，移除 Consolidated 目录"
```

---

## Task 3: `NoteAnalyzeResponse` / `QuickNoteRequest` 新增 `newTagDescriptions` 字段

**Files:**
- Modify: `backend/src/main/java/com/nexus/dto/response/NoteAnalyzeResponse.java`
- Modify: `backend/src/main/java/com/nexus/dto/request/QuickNoteRequest.java`

- [ ] **Step 1: `NoteAnalyzeResponse` 新增字段**

在 `backend/src/main/java/com/nexus/dto/response/NoteAnalyzeResponse.java` 顶部 import 中新增：

```java
import java.util.Map;
```

在类中新增字段（放在 `confidence` 字段之后）：

```java
    /** AI 本次新建标签的范围说明，key 为标签名；仅包含索引中尚不存在的标签 */
    private Map<String, String> newTagDescriptions;
```

- [ ] **Step 2: `QuickNoteRequest` 新增字段**

在 `backend/src/main/java/com/nexus/dto/request/QuickNoteRequest.java` 顶部 import 中新增：

```java
import java.util.Map;
```

在类中新增字段（放在 `tags` 字段之后）：

```java
    /** AI 本次分析新建的标签说明（仅在 tags 含新标签时提供），保存时写回标签索引 */
    private Map<String, String> newTagDescriptions;
```

- [ ] **Step 3: 编译确认**

Run: `cd backend && mvn compile`
Expected: BUILD SUCCESS（或与 Task 2 相同的预期失败，未新增问题）

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/nexus/dto/response/NoteAnalyzeResponse.java backend/src/main/java/com/nexus/dto/request/QuickNoteRequest.java
git commit -m "feat: NoteAnalyzeResponse/QuickNoteRequest 新增 newTagDescriptions 字段"
```

---

## Task 4: `NoteAiService` 接入标签索引（标签限制 ≤3，新建标签说明）

**Files:**
- Modify: `backend/src/main/java/com/nexus/service/NoteAiService.java`
- Create: `backend/src/test/java/com/nexus/service/NoteAiServiceTest.java`

- [ ] **Step 1: 编写 `NoteAiServiceTest` 失败测试**

```java
package com.nexus.service;

import com.nexus.dto.request.NoteAnalyzeRequest;
import com.nexus.dto.response.NoteAnalyzeResponse;
import com.nexus.dto.response.NoteTagEntryResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoteAiServiceTest {

    @Mock
    private LlmConfigService llmConfigService;
    @Mock
    private InboxSettingsService inboxSettingsService;
    @Mock
    private NoteTagIndexService noteTagIndexService;
    @Mock
    private ChatLanguageModel chatLanguageModel;

    @InjectMocks
    private NoteAiService noteAiService;

    @Test
    void analyzeShouldDegradeAndCapTagsWhenAiNotAvailable() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of());

        NoteAnalyzeRequest req = new NoteAnalyzeRequest();
        req.setContent("今天学习了 Spring Boot");
        req.setKind("quick_note");
        req.setTags(List.of("a", "b", "c", "d"));

        NoteAnalyzeResponse resp = noteAiService.analyze(req);

        assertThat(resp.isAiAvailable()).isFalse();
        assertThat(resp.getSuggestedTags()).containsExactly("a", "b", "c");
        assertThat(resp.getNewTagDescriptions()).isEmpty();
    }

    @Test
    void analyzeShouldParseSuggestedTagsAndNewTagDescriptions() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of(
                tag("技术", "编程、工具链、技术学习相关内容")
        ));
        when(llmConfigService.resolveModel("inbox")).thenReturn(chatLanguageModel);
        when(chatLanguageModel.generate(anyString())).thenReturn("""
                ```json
                {
                  "title": "Spring Boot 学习笔记",
                  "kind": "quick_note",
                  "tags": ["技术", "学习", "新标签"],
                  "new_tags": [{"name": "学习", "description": "学习过程记录与心得"}],
                  "category": "技术",
                  "folder": "tech",
                  "cleaned_markdown": "# Spring Boot 学习笔记\\n\\n今天学习了 Spring Boot",
                  "action_items": [],
                  "confidence": "high"
                }
                ```
                """);

        NoteAnalyzeRequest req = new NoteAnalyzeRequest();
        req.setContent("今天学习了 Spring Boot");
        req.setKind("quick_note");
        req.setTags(List.of());

        NoteAnalyzeResponse resp = noteAiService.analyze(req);

        assertThat(resp.isAiAvailable()).isTrue();
        assertThat(resp.getSuggestedTags()).containsExactly("技术", "学习", "新标签");
        assertThat(resp.getNewTagDescriptions()).containsEntry("学习", "学习过程记录与心得");
        // "新标签" 在 new_tags 中没有提供说明，不应出现在 newTagDescriptions
        assertThat(resp.getNewTagDescriptions()).doesNotContainKey("新标签");
        // "技术" 已在索引中存在，即使被 LLM 误放入 new_tags 也不应出现
        assertThat(resp.getNewTagDescriptions()).doesNotContainKey("技术");
    }

    @Test
    void analyzeShouldCapSuggestedTagsAtThree() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(noteTagIndexService.listTags("memo")).thenReturn(List.of());
        when(llmConfigService.resolveModel("inbox")).thenReturn(chatLanguageModel);
        when(chatLanguageModel.generate(anyString())).thenReturn("""
                {
                  "title": "备忘",
                  "kind": "memo",
                  "tags": ["a", "b", "c", "d", "e"],
                  "new_tags": [],
                  "confidence": "medium"
                }
                """);

        NoteAnalyzeRequest req = new NoteAnalyzeRequest();
        req.setContent("备忘内容");
        req.setKind("memo");
        req.setTags(List.of());

        NoteAnalyzeResponse resp = noteAiService.analyze(req);

        assertThat(resp.getSuggestedTags()).hasSize(3);
    }

    private NoteTagEntryResponse tag(String name, String description) {
        NoteTagEntryResponse entry = new NoteTagEntryResponse();
        entry.setName(name);
        entry.setDescription(description);
        return entry;
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && mvn test -Dtest=NoteAiServiceTest`
Expected: FAIL（`NoteAiService` 尚未注入 `NoteTagIndexService`，`getNewTagDescriptions()` 不存在或为 null）

- [ ] **Step 3: 修改 `NoteAiService`**

在 `backend/src/main/java/com/nexus/service/NoteAiService.java` 中：

1. 新增字段（在 `inboxSettingsService` 字段下方）：

```java
    private final NoteTagIndexService noteTagIndexService;
```

2. 新增 import：

```java
import com.nexus.dto.response.NoteTagEntryResponse;

import java.util.LinkedHashMap;
import java.util.Set;
import java.util.stream.Collectors;
```

3. 将 `analyze()` 方法整体替换为：

```java
    public NoteAnalyzeResponse analyze(NoteAnalyzeRequest req) {
        NoteAnalyzeResponse resp = new NoteAnalyzeResponse();
        resp.setAiAvailable(false);

        // 标签索引：AI 打标签时优先复用，全部标签（复用+新建）不超过 3 个
        List<NoteTagEntryResponse> existingTags = noteTagIndexService.listTags(req.getKind());

        // 1. LLM 可用性检查
        if (!inboxSettingsService.isInboxAiAvailable()) {
            resp.setSuggestedTitle(req.getTitle());
            resp.setSuggestedKind(req.getKind());
            resp.setSuggestedTags(capTags(req.getTags()));
            resp.setNewTagDescriptions(Map.of());
            return resp;
        }

        // 2. 调用 LLM 分析
        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            String prompt = buildNoteAnalyzePrompt(req, existingTags);
            String response = model.generate(prompt);

            log.debug("LLM 分析原始响应长度: {}", response.length());

            String jsonStr = extractJson(response);
            Map<String, Object> result = objectMapper.readValue(jsonStr,
                    new TypeReference<Map<String, Object>>() {});

            resp.setAiAvailable(true);

            // 解析各字段
            resp.setSuggestedTitle(getString(result, "title", req.getTitle()));
            resp.setSuggestedKind(getString(result, "kind", req.getKind()));
            resp.setSuggestedCategory(getString(result, "category", null));
            resp.setSuggestedFolder(getString(result, "folder", null));
            resp.setCleanedMarkdown(getString(result, "cleaned_markdown", null));
            resp.setConfidence(getString(result, "confidence", null));

            // 解析 tags，最终数量限制为 ≤3（截断多余项），防止标签爆炸
            Object tagsObj = result.get("tags");
            List<String> tags;
            if (tagsObj instanceof List<?> tagsList) {
                tags = new ArrayList<>();
                for (Object tag : tagsList) {
                    if (tag != null) tags.add(tag.toString());
                }
                if (tags.isEmpty()) tags = req.getTags();
            } else {
                tags = req.getTags();
            }
            resp.setSuggestedTags(capTags(tags));

            // 解析 new_tags：仅保留索引中尚不存在的标签及其说明，随保存请求写回索引
            Set<String> existingNames = existingTags.stream()
                    .map(NoteTagEntryResponse::getName)
                    .collect(Collectors.toSet());
            Map<String, String> newTagDescriptions = new LinkedHashMap<>();
            Object newTagsObj = result.get("new_tags");
            if (newTagsObj instanceof List<?> newTagsList) {
                for (Object item : newTagsList) {
                    if (item instanceof Map<?, ?> tagMap) {
                        Object name = tagMap.get("name");
                        Object description = tagMap.get("description");
                        if (name != null && !existingNames.contains(name.toString())) {
                            newTagDescriptions.put(name.toString(),
                                    description != null ? description.toString() : "");
                        }
                    }
                }
            }
            resp.setNewTagDescriptions(newTagDescriptions);

            // 解析 action_items
            Object itemsObj = result.get("action_items");
            if (itemsObj instanceof List<?> itemsList) {
                List<ActionItem> actionItems = new ArrayList<>();
                for (Object item : itemsList) {
                    if (item instanceof Map<?, ?> itemMap) {
                        ActionItem ai = new ActionItem();
                        Object desc = itemMap.get("description");
                        Object prio = itemMap.get("priority");
                        if (desc != null) ai.setDescription(desc.toString());
                        if (prio != null) ai.setPriority(prio.toString());
                        if (ai.getDescription() != null) actionItems.add(ai);
                    }
                }
                resp.setActionItems(actionItems);
            }

        } catch (Exception e) {
            log.warn("笔记 AI 分析失败，降级返回原文: {}", e.getMessage());
            resp.setAiAvailable(false);
            resp.setSuggestedTitle(req.getTitle());
            resp.setSuggestedKind(req.getKind());
            resp.setSuggestedTags(capTags(req.getTags()));
            resp.setNewTagDescriptions(Map.of());
        }

        return resp;
    }

    /** 将标签列表截断至最多 3 个，防止标签爆炸；null 时原样返回 */
    private List<String> capTags(List<String> tags) {
        if (tags == null) return null;
        return tags.size() > 3 ? new ArrayList<>(tags.subList(0, 3)) : tags;
    }
```

4. 将 `buildNoteAnalyzePrompt` 方法整体替换为：

```java
    /**
     * 构建发送给 LLM 的笔记分析中文 Prompt。
     * 包含已有标签索引，引导 LLM 优先复用标签、控制标签总数 ≤3，必要时通过 new_tags 新建。
     */
    private String buildNoteAnalyzePrompt(NoteAnalyzeRequest req, List<NoteTagEntryResponse> existingTags) {
        String tagsStr = "";
        if (req.getTags() != null && !req.getTags().isEmpty()) {
            tagsStr = String.join(", ", req.getTags());
        }

        String tagIndexStr = existingTags.isEmpty()
                ? "（暂无已有标签）"
                : existingTags.stream()
                        .map(t -> "- " + t.getName() + ": " + t.getDescription())
                        .collect(Collectors.joining("\n"));

        return """
                你是一个个人知识管理助手。请分析以下笔记内容，返回严格的 JSON 格式。

                笔记内容：
                %s

                已有标题：%s
                已有类型：%s
                已有标签：%s

                已有标签索引（请优先从中选择语义匹配的标签）：
                %s

                请返回 JSON（不要包含 markdown 代码块标记）：
                {
                  "title": "建议的标题",
                  "kind": "quick_note 或 memo",
                  "tags": ["标签1", "标签2"],
                  "new_tags": [{"name": "新标签名", "description": "该标签适用范围的一句话说明"}],
                  "category": "建议的分类（如 技术/阅读/生活/工作/学习）",
                  "folder": "建议的 Obsidian 子文件夹",
                  "cleaned_markdown": "整理后的 Markdown 内容",
                  "action_items": [
                    {"description": "行动项描述", "priority": "high|medium|low"}
                  ],
                  "confidence": "high|medium|low"
                }

                标签要求：
                - 优先复用"已有标签索引"中语义匹配的标签
                - tags 字段最终数量（复用 + 新建）不超过 3 个
                - 仅在确有必要且已有标签都不适用时，通过 new_tags 新建标签，并给出一句话范围说明
                - 若无需新建标签，new_tags 返回空数组 []

                其他要求：
                - 标题简洁（不超过 30 字）
                - cleaned_markdown 保留原文核心信息，提升格式和可读性
                - 行动项仅提取明确需要后续执行的内容
                """
                .formatted(req.getContent(),
                        req.getTitle() != null ? req.getTitle() : "",
                        req.getKind() != null ? req.getKind() : "",
                        tagsStr,
                        tagIndexStr);
    }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && mvn test -Dtest=NoteAiServiceTest`
Expected: PASS（3 个测试全部通过）

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/nexus/service/NoteAiService.java backend/src/test/java/com/nexus/service/NoteAiServiceTest.java
git commit -m "feat: NoteAiService 接入标签索引，标签数量限制为 3 个以内"
```

---

## Task 5: `ObsidianMarkdownWriter` 保存后写回标签索引

**Files:**
- Modify: `backend/src/main/java/com/nexus/inbox/note/ObsidianMarkdownWriter.java`
- Modify: `backend/src/test/java/com/nexus/inbox/note/ObsidianMarkdownWriterTest.java`

- [ ] **Step 1: 在测试文件中新增 `NoteTagIndexService` Mock 并更新所有构造调用**

在 `backend/src/test/java/com/nexus/inbox/note/ObsidianMarkdownWriterTest.java` 中：

1. 新增 import：

```java
import com.nexus.service.NoteTagIndexService;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.lenient;
```

（`List` 已存在则不重复添加；`Map`/`verify`/`lenient` 为新增）

2. 新增字段（紧跟 `inboxSettingsService` 字段之后）：

```java
    @Mock
    private NoteTagIndexService noteTagIndexService;
```

3. 将 `setUp()` 中的构造调用：

```java
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService);
```

替换为：

```java
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService, noteTagIndexService);
```

4. 将 `writeShouldThrowWhenVaultNotConfigured()` 中的：

```java
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService);
```

替换为：

```java
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService, noteTagIndexService);
```

5. 将 `writeShouldPreventPathTraversal()` 中的：

```java
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService);
```

替换为：

```java
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService, noteTagIndexService);
```

- [ ] **Step 2: 新增测试：保存带标签的笔记后应调用 `syncNewTags`**

在 `writeShouldCreateMarkdownFileWithFrontMatter()` 测试方法末尾追加断言（该测试已设置 `req.setTags(List.of("inbox", "test"))`）：

```java
        verify(noteTagIndexService).syncNewTags("quick_note", Map.of());
```

并新增一个独立测试方法（放在 `writeShouldCreateMarkdownFileWithFrontMatter` 之后）：

```java
    @Test
    void writeShouldSyncNewTagDescriptionsWhenProvided() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("带新标签的笔记");
        req.setTags(List.of("技术", "新标签"));
        req.setNewTagDescriptions(Map.of("新标签", "AI 新建的标签说明"));

        writer.write(req);

        verify(noteTagIndexService).syncNewTags("quick_note", Map.of("新标签", "AI 新建的标签说明"));
    }

    @Test
    void writeShouldNotSyncTagsWhenTagsEmpty() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("无标签的笔记");

        writer.write(req);

        verify(noteTagIndexService, org.mockito.Mockito.never()).syncNewTags(any(), any());
    }
```

新增 import：

```java
import static org.mockito.ArgumentMatchers.any;
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend && mvn test -Dtest=ObsidianMarkdownWriterTest`
Expected: FAIL（编译错误：`ObsidianMarkdownWriter` 构造函数不接受第三个参数）

- [ ] **Step 4: 修改 `ObsidianMarkdownWriter`**

在 `backend/src/main/java/com/nexus/inbox/note/ObsidianMarkdownWriter.java` 中：

1. 新增 import：

```java
import com.nexus.dto.response.NoteTagEntryResponse;
import com.nexus.service.NoteTagIndexService;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
```

2. 新增字段（紧跟 `inboxSettingsService` 字段之后）：

```java
    private final NoteTagIndexService noteTagIndexService;
```

（`@RequiredArgsConstructor` 会自动生成包含该字段的构造函数）

3. 在 `write()` 方法中，将：

```java
        QuickNoteResponse resp = new QuickNoteResponse();
        resp.setPath(filePath.toString());
        // 返回相对 vault 路径给前端展示，不暴露绝对路径
        Path relativePath = vaultRoot.relativize(filePath);
        resp.setRelativePath(relativePath.toString());
        resp.setCreatedAt(now.format(ISO_FORMATTER));
        return resp;
```

替换为：

```java
        // 保存成功后同步标签索引：仅新建索引中不存在的标签，已有标签不重复写入
        if (req.getTags() != null && !req.getTags().isEmpty()) {
            Map<String, String> newTagDescriptions = req.getNewTagDescriptions() != null
                    ? req.getNewTagDescriptions() : Map.of();
            noteTagIndexService.syncNewTags(req.getKind(), newTagDescriptions);

            // 异常路径校验：标签既不在索引中也没有提供说明时记录 warning，不中断保存
            Set<String> indexedNames = noteTagIndexService.listTags(req.getKind()).stream()
                    .map(NoteTagEntryResponse::getName)
                    .collect(Collectors.toSet());
            for (String tag : req.getTags()) {
                if (!indexedNames.contains(tag) && !newTagDescriptions.containsKey(tag)) {
                    log.warn("笔记标签 '{}' 不在标签索引中且无说明，已跳过索引同步", tag);
                }
            }
        }

        QuickNoteResponse resp = new QuickNoteResponse();
        resp.setPath(filePath.toString());
        // 返回相对 vault 路径给前端展示，不暴露绝对路径
        Path relativePath = vaultRoot.relativize(filePath);
        resp.setRelativePath(relativePath.toString());
        resp.setCreatedAt(now.format(ISO_FORMATTER));
        return resp;
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && mvn test -Dtest=ObsidianMarkdownWriterTest`
Expected: PASS（全部测试通过）

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/nexus/inbox/note/ObsidianMarkdownWriter.java backend/src/test/java/com/nexus/inbox/note/ObsidianMarkdownWriterTest.java
git commit -m "feat: ObsidianMarkdownWriter 保存笔记后同步新标签到标签索引"
```

---

## Task 6: 新增 `NoteSummaryService`（替换 `NoteConsolidationService`）+ 汇总 DTO

**Files:**
- Create: `backend/src/main/java/com/nexus/dto/request/NoteSummarizeRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/NoteSummarizeResponse.java`
- Create: `backend/src/main/java/com/nexus/service/NoteSummaryService.java`
- Create: `backend/src/test/java/com/nexus/service/NoteSummaryServiceTest.java`
- Delete (in this task): `backend/src/main/java/com/nexus/service/NoteConsolidationService.java`
- Delete (in this task): `backend/src/main/java/com/nexus/dto/request/NoteConsolidatePreviewRequest.java`
- Delete (in this task): `backend/src/main/java/com/nexus/dto/request/NoteConsolidateWriteRequest.java`
- Delete (in this task): `backend/src/main/java/com/nexus/dto/response/NoteConsolidatePreviewResponse.java`

- [ ] **Step 1: 创建 `NoteSummarizeRequest` DTO**

```java
package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/** 笔记汇总请求：按标题关键词和/或标签筛选笔记，AI 生成汇总 Markdown（不写入文件）。 */
@Data
public class NoteSummarizeRequest {
    /** 笔记类型：quick_note / memo，必填 */
    @NotBlank(message = "kind 不能为空")
    private String kind;
    /** 标题模糊匹配关键词，可选 */
    private String titleQuery;
    /** 标签筛选（与笔记标签取交集），可选 */
    private List<String> tags;
}
```

- [ ] **Step 2: 创建 `NoteSummarizeResponse` DTO**

```java
package com.nexus.dto.response;

import lombok.Data;

/** 笔记汇总响应：匹配到的笔记数量及 AI 生成的 Markdown 汇总。 */
@Data
public class NoteSummarizeResponse {
    /** 汇总后的 Markdown，无匹配时为 null */
    private String markdown;
    /** 匹配到的笔记数量 */
    private int matchedCount;
}
```

- [ ] **Step 3: 编写 `NoteSummaryServiceTest` 失败测试**

```java
package com.nexus.service;

import com.nexus.dto.request.NoteSummarizeRequest;
import com.nexus.dto.response.NoteSummarizeResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoteSummaryServiceTest {

    @Mock
    private LlmConfigService llmConfigService;
    @Mock
    private InboxSettingsService inboxSettingsService;
    @Mock
    private ChatLanguageModel chatLanguageModel;

    private NoteSummaryService service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() throws IOException {
        service = new NoteSummaryService(llmConfigService, inboxSettingsService, new com.fasterxml.jackson.databind.ObjectMapper());

        Path quickNoteDir = tempDir.resolve("Inbox/Quick Note/2026/06");
        Files.createDirectories(quickNoteDir);

        Files.writeString(quickNoteDir.resolve("note1.md"), """
                ---
                source: nexus
                type: quick_note
                created: 2026-06-01T10:00:00+08:00
                tags:
                  - 技术
                  - 学习
                ---

                # Spring Boot 学习笔记

                今天学习了依赖注入。
                """, StandardCharsets.UTF_8);

        Files.writeString(quickNoteDir.resolve("note2.md"), """
                ---
                source: nexus
                type: quick_note
                created: 2026-06-02T10:00:00+08:00
                tags:
                  - 生活
                ---

                # 周末计划

                打算去爬山。
                """, StandardCharsets.UTF_8);

        when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(tempDir.toString());
        when(inboxSettingsService.getObsidianQuickNoteDir()).thenReturn("Inbox/Quick Note");
    }

    @Test
    void summarizeShouldReturnEmptyWhenNoFilterProvided() {
        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(0);
        assertThat(resp.getMarkdown()).isNull();
    }

    @Test
    void summarizeShouldMatchByTitleQuery() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);

        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");
        req.setTitleQuery("Spring");

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(1);
        assertThat(resp.getMarkdown()).contains("Spring Boot 学习笔记");
        assertThat(resp.getMarkdown()).contains("依赖注入");
    }

    @Test
    void summarizeShouldMatchByTagIntersection() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);

        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");
        req.setTags(List.of("生活"));

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(1);
        assertThat(resp.getMarkdown()).contains("周末计划");
    }

    @Test
    void summarizeShouldReturnZeroWhenNothingMatches() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);

        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");
        req.setTitleQuery("不存在的关键词");

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(0);
        assertThat(resp.getMarkdown()).isNull();
    }

    @Test
    void summarizeShouldUseLlmWhenAvailable() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(llmConfigService.resolveModel("inbox")).thenReturn(chatLanguageModel);
        when(chatLanguageModel.generate(anyString())).thenReturn("""
                ```json
                {"markdown": "# 技术笔记汇总\\n\\n- 依赖注入相关内容"}
                ```
                """);

        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");
        req.setTags(List.of("技术"));

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(1);
        assertThat(resp.getMarkdown()).isEqualTo("# 技术笔记汇总\n\n- 依赖注入相关内容");
    }
}
```

- [ ] **Step 4: 运行测试确认失败**

Run: `cd backend && mvn test -Dtest=NoteSummaryServiceTest`
Expected: FAIL（`NoteSummaryService` 不存在）

- [ ] **Step 5: 创建 `NoteSummaryService`**

```java
package com.nexus.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.NoteSummarizeRequest;
import com.nexus.dto.response.NoteSummarizeResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 笔记汇总服务：按标题关键词和/或标签筛选 Quick Note / Memo 笔记，
 * 调用 LLM 生成汇总 Markdown（不写入文件）。LLM 不可用时降级为简单拼接。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteSummaryService {

    private final LlmConfigService llmConfigService;
    private final InboxSettingsService inboxSettingsService;
    private final ObjectMapper objectMapper;

    /** 从 LLM 响应中提取 JSON 的正则 */
    private static final Pattern JSON_BLOCK_PATTERN = Pattern.compile(
            "```(?:json)?\\s*\\n?([\\s\\S]*?)```");

    /**
     * 按筛选条件汇总笔记。
     * titleQuery 和 tags 均为空时不扫描，直接返回空结果（matchedCount=0, markdown=null）。
     *
     * @param req 筛选条件：kind 必填，titleQuery / tags 至少一个非空
     * @return 汇总结果
     */
    public NoteSummarizeResponse summarize(NoteSummarizeRequest req) {
        NoteSummarizeResponse resp = new NoteSummarizeResponse();

        boolean hasTitleQuery = req.getTitleQuery() != null && !req.getTitleQuery().isBlank();
        boolean hasTags = req.getTags() != null && !req.getTags().isEmpty();
        if (!hasTitleQuery && !hasTags) {
            resp.setMatchedCount(0);
            resp.setMarkdown(null);
            return resp;
        }

        List<SourceNote> matched = scanMatchingNotes(req, hasTitleQuery, hasTags);
        resp.setMatchedCount(matched.size());
        if (matched.isEmpty()) {
            resp.setMarkdown(null);
            return resp;
        }

        if (!inboxSettingsService.isInboxAiAvailable()) {
            resp.setMarkdown(buildFallbackMarkdown(matched));
            return resp;
        }

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            String prompt = buildSummarizePrompt(matched);
            String response = model.generate(prompt);

            String jsonStr = extractJson(response);
            if ("{}".equals(jsonStr)) {
                resp.setMarkdown(response);
            } else {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = objectMapper.readValue(jsonStr, Map.class);
                resp.setMarkdown(getString(result, "markdown", buildFallbackMarkdown(matched)));
            }
        } catch (Exception e) {
            log.warn("笔记汇总 LLM 调用失败，降级为简单拼接: {}", e.getMessage());
            resp.setMarkdown(buildFallbackMarkdown(matched));
        }

        return resp;
    }

    /**
     * 扫描对应 kind 目录下所有 .md 文件，按标题/标签筛选条件返回匹配的笔记。
     * 两个条件均提供时取交集（AND）；Vault 未配置或目录不存在时返回空列表。
     */
    private List<SourceNote> scanMatchingNotes(NoteSummarizeRequest req, boolean hasTitleQuery, boolean hasTags) {
        String vaultPath = inboxSettingsService.get("inbox.obsidian.vault_path");
        if (vaultPath == null || vaultPath.isBlank()) {
            return List.of();
        }

        String noteDir = "memo".equals(req.getKind())
                ? inboxSettingsService.getObsidianMemoDir()
                : inboxSettingsService.getObsidianQuickNoteDir();

        Path vaultRoot = Paths.get(vaultPath).normalize().toAbsolutePath();
        Path noteRoot = vaultRoot.resolve(noteDir).normalize().toAbsolutePath();
        if (!noteRoot.startsWith(vaultRoot) || !Files.isDirectory(noteRoot)) {
            return List.of();
        }

        String titleQueryLower = hasTitleQuery ? req.getTitleQuery().trim().toLowerCase() : null;

        List<SourceNote> matched = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(noteRoot)) {
            for (Path path : paths.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".md"))
                    .toList()) {
                String content;
                try {
                    content = Files.readString(path, StandardCharsets.UTF_8);
                } catch (IOException e) {
                    log.warn("读取笔记失败，已跳过: {} - {}", path, e.getMessage());
                    continue;
                }
                String title = extractTitleFromContent(content);
                List<String> tags = extractTagsFromFrontMatter(content);

                boolean titleMatches = !hasTitleQuery
                        || (title != null && title.toLowerCase().contains(titleQueryLower));
                boolean tagsMatch = !hasTags
                        || tags.stream().anyMatch(req.getTags()::contains);

                if (titleMatches && tagsMatch) {
                    matched.add(new SourceNote(title, stripFrontMatter(content)));
                }
            }
        } catch (IOException e) {
            log.warn("扫描笔记目录失败: {}", e.getMessage());
        }
        return matched;
    }

    /** 构建 LLM 汇总 Prompt */
    private String buildSummarizePrompt(List<SourceNote> notes) {
        StringBuilder notesSection = new StringBuilder();
        int idx = 1;
        for (SourceNote sn : notes) {
            notesSection.append("--- 笔记 ").append(idx).append(" ---\n");
            if (sn.title() != null) {
                notesSection.append("标题: ").append(sn.title()).append("\n");
            }
            notesSection.append(sn.content()).append("\n\n");
            idx++;
        }

        return """
                你是一个个人知识管理助手。请阅读以下 %d 条笔记，生成一份汇总 Markdown。
                返回严格的 JSON 格式（不要包含 markdown 代码块标记）。

                %s

                请返回 JSON：
                {
                  "markdown": "汇总内容（Markdown 格式，包含标题）"
                }

                要求：
                - 按主题归类，去重合并相似信息
                - 保留关键信息和重要细节
                - 使用清晰的标题和列表结构
                """
                .formatted(notes.size(), notesSection.toString());
    }

    /** LLM 不可用时的降级汇总：按匹配顺序简单拼接 */
    private String buildFallbackMarkdown(List<SourceNote> notes) {
        StringBuilder sb = new StringBuilder();
        sb.append("# 笔记汇总\n\n");
        for (int i = 0; i < notes.size(); i++) {
            if (i > 0) sb.append("\n---\n\n");
            SourceNote sn = notes.get(i);
            if (sn.title() != null) {
                sb.append("### ").append(sn.title()).append("\n\n");
            }
            sb.append(sn.content()).append("\n");
        }
        return sb.toString();
    }

    /**
     * 去除 YAML front matter，返回正文内容。
     */
    private String stripFrontMatter(String content) {
        if (content == null || !content.trim().startsWith("---")) {
            return content != null ? content : "";
        }
        int end = content.indexOf("---", 3);
        if (end < 0) return content;
        return content.substring(end + 3).trim();
    }

    /**
     * 从 Markdown 内容中提取标题（首个 # heading），fallback 返回 null。
     */
    private String extractTitleFromContent(String content) {
        if (content == null) return null;
        for (String line : content.split("\\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("# ")) {
                return trimmed.substring(2).trim();
            }
        }
        return null;
    }

    /**
     * 从 YAML front matter 中提取 tags 列表（"tags:" 后的 "  - xxx" 行）。
     * front matter 不存在或无 tags 字段时返回空列表。
     */
    private List<String> extractTagsFromFrontMatter(String content) {
        if (content == null || !content.trim().startsWith("---")) {
            return List.of();
        }
        int end = content.indexOf("---", 3);
        if (end < 0) return List.of();
        String frontMatter = content.substring(0, end);

        List<String> tags = new ArrayList<>();
        boolean inTags = false;
        for (String line : frontMatter.split("\\n")) {
            String trimmed = line.trim();
            if (trimmed.equals("tags:")) {
                inTags = true;
                continue;
            }
            if (inTags) {
                if (trimmed.startsWith("- ")) {
                    tags.add(trimmed.substring(2).trim());
                } else if (!trimmed.isEmpty()) {
                    inTags = false;
                }
            }
        }
        return tags;
    }

    /**
     * 从 LLM 响应中提取 JSON 字符串。
     * 处理 ```json ... ``` 包裹以及直接返回 JSON 的情况。
     */
    private String extractJson(String response) {
        if (response == null || response.isBlank()) {
            return "{}";
        }
        Matcher matcher = JSON_BLOCK_PATTERN.matcher(response);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        int start = response.indexOf('{');
        int end = response.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return response.substring(start, end + 1).trim();
        }
        log.warn("无法从 LLM 响应中提取 JSON，原始响应前 200 字符: {}",
                response.substring(0, Math.min(200, response.length())));
        return "{}";
    }

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        Object val = map.get(key);
        if (val == null) return defaultValue;
        String str = val.toString();
        return str.isBlank() ? defaultValue : str;
    }

    /** 匹配到的源笔记内部数据结构 */
    private record SourceNote(String title, String content) {}
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd backend && mvn test -Dtest=NoteSummaryServiceTest`
Expected: PASS（5 个测试全部通过）

- [ ] **Step 7: 删除旧的 consolidate 相关文件**

```bash
git rm backend/src/main/java/com/nexus/service/NoteConsolidationService.java
git rm backend/src/main/java/com/nexus/dto/request/NoteConsolidatePreviewRequest.java
git rm backend/src/main/java/com/nexus/dto/request/NoteConsolidateWriteRequest.java
git rm backend/src/main/java/com/nexus/dto/response/NoteConsolidatePreviewResponse.java
```

注意：此步会导致 `InboxController` 编译失败（仍引用 `NoteConsolidationService` 与上述 DTO），这是预期的，将在 Task 7 中修复。

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/nexus/dto/request/NoteSummarizeRequest.java backend/src/main/java/com/nexus/dto/response/NoteSummarizeResponse.java backend/src/main/java/com/nexus/service/NoteSummaryService.java backend/src/test/java/com/nexus/service/NoteSummaryServiceTest.java
git commit -m "feat: 新增 NoteSummaryService 替换 NoteConsolidationService，支持标题/标签筛选 + AI 汇总"
```

---

## Task 7: `InboxController` 接口改造（新增标签/汇总接口，删除 consolidate 接口）

**Files:**
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Modify: `backend/src/test/java/com/nexus/controller/InboxControllerTest.java`

- [ ] **Step 1: 修改 `InboxController` 服务字段**

将：

```java
    private final NoteAiService noteAiService;
    private final NoteConsolidationService noteConsolidationService;
    private final NoteSinkPort noteSinkPort;
```

替换为：

```java
    private final NoteAiService noteAiService;
    private final NoteSummaryService noteSummaryService;
    private final NoteTagIndexService noteTagIndexService;
    private final NoteSinkPort noteSinkPort;
```

- [ ] **Step 2: 删除 consolidate 接口，新增标签 + 汇总接口**

将「笔记（Obsidian Markdown）」分组下，`analyzeNote()` 方法之后的两个 consolidate 接口：

```java
    /** 预览笔记合并结果（不写文件），只扫描 Nexus 写入的 Obsidian Inbox 目录 */
    @PostMapping("/notes/consolidate/preview")
    public ApiResponse<NoteConsolidatePreviewResponse> previewConsolidate(
            @Valid @RequestBody NoteConsolidatePreviewRequest req) {
        try {
            return ApiResponse.ok(noteConsolidationService.preview(req));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("CONSOLIDATE_INVALID", e.getMessage());
        } catch (Exception e) {
            log.error("合并预览失败", e);
            return ApiResponse.error("CONSOLIDATE_FAILED", "合并预览失败");
        }
    }

    /** 执行笔记合并写入，合并后的文件 front matter 列出所有源文件 */
    @PostMapping("/notes/consolidate/write")
    public ApiResponse<QuickNoteResponse> writeConsolidate(@Valid @RequestBody NoteConsolidateWriteRequest req) {
        try {
            return ApiResponse.ok(noteConsolidationService.write(req));
        } catch (IllegalStateException e) {
            return ApiResponse.error("OBSIDIAN_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("CONSOLIDATE_INVALID", e.getMessage());
        } catch (SecurityException e) {
            log.warn("合并写入路径穿越检测: {}", e.getMessage());
            return ApiResponse.error("OBSIDIAN_WRITE_FAILED", "文件路径不安全");
        } catch (Exception e) {
            log.error("合并写入失败", e);
            return ApiResponse.error("CONSOLIDATE_FAILED", "合并写入失败");
        }
    }
}
```

替换为：

```java
    /** 获取笔记标签索引列表，供前端 TagPicker 拉取可选标签 */
    @GetMapping("/notes/tags")
    public ApiResponse<List<NoteTagEntryResponse>> listNoteTags(@RequestParam String kind) {
        return ApiResponse.ok(noteTagIndexService.listTags(kind));
    }

    /** 按标题关键词 + 标签筛选笔记，AI 生成 Markdown 汇总（不写入文件） */
    @PostMapping("/notes/summarize")
    public ApiResponse<NoteSummarizeResponse> summarizeNotes(@Valid @RequestBody NoteSummarizeRequest req) {
        try {
            return ApiResponse.ok(noteSummaryService.summarize(req));
        } catch (Exception e) {
            log.error("笔记汇总失败", e);
            return ApiResponse.error("NOTE_SUMMARIZE_FAILED", "笔记汇总失败");
        }
    }
}
```

（`NoteTagEntryResponse`、`NoteSummarizeRequest`、`NoteSummarizeResponse`、`List` 均已被现有 `com.nexus.dto.request.*` / `com.nexus.dto.response.*` / `java.util.List` 通配导入覆盖，无需新增 import）

- [ ] **Step 3: 更新 `InboxControllerTest`**

将 Mock 字段：

```java
    @Mock
    private NoteAiService noteAiService;
    @Mock
    private NoteConsolidationService noteConsolidationService;
    @Mock
    private NoteSinkPort noteSinkPort;
```

替换为：

```java
    @Mock
    private NoteAiService noteAiService;
    @Mock
    private NoteSummaryService noteSummaryService;
    @Mock
    private NoteTagIndexService noteTagIndexService;
    @Mock
    private NoteSinkPort noteSinkPort;
```

在文件末尾（`createNoteShouldRequireContent()` 测试之后，类结束 `}` 之前）新增以下测试：

```java

    // ======================== 笔记标签索引 ========================

    @Test
    void listNoteTagsShouldReturnTagEntries() {
        var tag = new com.nexus.dto.response.NoteTagEntryResponse();
        tag.setName("技术");
        tag.setDescription("编程、工具链、技术学习相关内容");
        when(noteTagIndexService.listTags("quick_note")).thenReturn(java.util.List.of(tag));

        var resp = inboxController.listNoteTags("quick_note");

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData()).hasSize(1);
        assertThat(resp.getData().get(0).getName()).isEqualTo("技术");
    }

    // ======================== 笔记汇总 ========================

    @Test
    void summarizeNotesShouldReturnEmptyResultWhenNoFilter() {
        var serviceResp = new com.nexus.dto.response.NoteSummarizeResponse();
        serviceResp.setMatchedCount(0);
        serviceResp.setMarkdown(null);
        when(noteSummaryService.summarize(any())).thenReturn(serviceResp);

        var req = new com.nexus.dto.request.NoteSummarizeRequest();
        req.setKind("quick_note");

        var resp = inboxController.summarizeNotes(req);

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData().getMatchedCount()).isEqualTo(0);
        assertThat(resp.getData().getMarkdown()).isNull();
    }

    @Test
    void summarizeNotesShouldReturnErrorWhenServiceThrows() {
        when(noteSummaryService.summarize(any())).thenThrow(new RuntimeException("扫描失败"));

        var req = new com.nexus.dto.request.NoteSummarizeRequest();
        req.setKind("memo");
        req.setTitleQuery("关键词");

        var resp = inboxController.summarizeNotes(req);

        assertThat(resp.isSuccess()).isFalse();
        assertThat(resp.getErrorCode()).isEqualTo("NOTE_SUMMARIZE_FAILED");
    }
```

- [ ] **Step 4: 运行全部 InboxController 测试**

Run: `cd backend && mvn test -Dtest=InboxControllerTest`
Expected: PASS（全部测试通过）

- [ ] **Step 5: 编译并运行完整后端测试套件**

Run: `cd backend && mvn test`
Expected: BUILD SUCCESS（确认 Task 2/6 中遗留的编译问题已全部解决）

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/nexus/controller/InboxController.java backend/src/test/java/com/nexus/controller/InboxControllerTest.java
git commit -m "feat: InboxController 新增 /notes/tags、/notes/summarize，删除 consolidate 接口"
```

---

## Task 8: 前端类型定义更新（`domain.types.ts`）

**Files:**
- Modify: `frontend/src/types/domain.types.ts`

- [ ] **Step 1: `QuickNoteRequest` 新增 `newTagDescriptions`**

将：

```typescript
/** Quick Note / Memo 请求 */
export interface QuickNoteRequest {
  title?: string
  content: string
  kind?: 'quick_note' | 'memo'
  tags?: string[]
}
```

替换为：

```typescript
/** Quick Note / Memo 请求 */
export interface QuickNoteRequest {
  title?: string
  content: string
  kind?: 'quick_note' | 'memo'
  tags?: string[]
  /** AI 本次分析新建的标签说明（key 为标签名），保存时后端写回标签索引 */
  newTagDescriptions?: Record<string, string>
}
```

- [ ] **Step 2: `NoteAnalyzeResponse` 新增 `newTagDescriptions`，删除 consolidate 类型，新增 `NoteTagEntry` / `NoteSummarizeRequest` / `NoteSummarizeResponse`**

将：

```typescript
export interface NoteAnalyzeResponse {
  suggestedTitle?: string
  suggestedKind?: string
  suggestedTags?: string[]
  suggestedCategory?: string
  suggestedFolder?: string
  cleanedMarkdown?: string
  actionItems?: ActionItem[]
  aiAvailable: boolean
  confidence?: string
}

export interface NoteConsolidatePreviewRequest {
  sourcePaths: string[]
  mode: string
  topic?: string
}

export interface NoteConsolidatePreviewResponse {
  title: string
  markdown: string
  sourcePaths: string[]
  suggestedPath: string
}

export interface NoteConsolidateWriteRequest {
  title: string
  markdown: string
  sourcePaths: string[]
  outputPath?: string
}
```

替换为：

```typescript
export interface NoteAnalyzeResponse {
  suggestedTitle?: string
  suggestedKind?: string
  suggestedTags?: string[]
  suggestedCategory?: string
  suggestedFolder?: string
  cleanedMarkdown?: string
  actionItems?: ActionItem[]
  aiAvailable: boolean
  confidence?: string
  /** AI 本次新建标签的范围说明，key 为标签名；仅包含索引中尚不存在的标签 */
  newTagDescriptions?: Record<string, string>
}

/** 标签索引条目：标签名 + 适用范围说明 */
export interface NoteTagEntry {
  name: string
  description: string
}

/** 笔记汇总请求：按标题关键词和/或标签筛选笔记 */
export interface NoteSummarizeRequest {
  kind: 'quick_note' | 'memo'
  titleQuery?: string
  tags?: string[]
}

/** 笔记汇总响应：匹配数量 + AI 生成的 Markdown 汇总 */
export interface NoteSummarizeResponse {
  markdown?: string
  matchedCount: number
}
```

- [ ] **Step 3: `InboxSettings` 删除 `obsidianConsolidationDir`**

将：

```typescript
  obsidianFileNamingPattern?: string
  obsidianConsolidationDir: string
  bookmarksAiAssistEnabled: boolean
```

替换为：

```typescript
  obsidianFileNamingPattern?: string
  bookmarksAiAssistEnabled: boolean
```

- [ ] **Step 4: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: 报错（`inbox.api.ts`、`InboxSettingsPanel.tsx` 等引用了已删除的类型/字段），这是预期的，将在后续任务中修复

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/domain.types.ts
git commit -m "feat: domain.types 新增标签索引/汇总类型，移除 consolidate 相关类型"
```

---

## Task 9: `inbox.api.ts` 接口方法更新

**Files:**
- Modify: `frontend/src/api/inbox.api.ts`

- [ ] **Step 1: 更新类型 import**

将：

```typescript
import type {
  InboxItem,
  Bookmark,
  InboxDocument,
  QuickNoteRequest,
  QuickNoteResponse,
  Paginated,
  BookmarkAnalyzeRequest,
  BookmarkAnalyzeResponse,
  BookmarkImportPreviewRequest,
  BookmarkImportPreviewResponse,
  BookmarkImportCommitRequest,
  BookmarkImportCommitResponse,
  BookmarkTagSummaryResponse,
  BookmarkSmartGroup,
  BookmarkSmartGroupRequest,
  BookmarkGroupPreviewRequest,
  BookmarkGroupPreviewResponse,
  BookmarkGroupApplyRequest,
  PaperlessGatewayStatusResponse,
  NoteAnalyzeRequest,
  NoteAnalyzeResponse,
  NoteConsolidatePreviewRequest,
  NoteConsolidatePreviewResponse,
  NoteConsolidateWriteRequest,
} from '../types/domain.types'
```

替换为：

```typescript
import type {
  InboxItem,
  Bookmark,
  InboxDocument,
  QuickNoteRequest,
  QuickNoteResponse,
  Paginated,
  BookmarkAnalyzeRequest,
  BookmarkAnalyzeResponse,
  BookmarkImportPreviewRequest,
  BookmarkImportPreviewResponse,
  BookmarkImportCommitRequest,
  BookmarkImportCommitResponse,
  BookmarkTagSummaryResponse,
  BookmarkSmartGroup,
  BookmarkSmartGroupRequest,
  BookmarkGroupPreviewRequest,
  BookmarkGroupPreviewResponse,
  BookmarkGroupApplyRequest,
  PaperlessGatewayStatusResponse,
  NoteAnalyzeRequest,
  NoteAnalyzeResponse,
  NoteTagEntry,
  NoteSummarizeRequest,
  NoteSummarizeResponse,
} from '../types/domain.types'
```

- [ ] **Step 2: 替换 `notes` 接口方法**

将：

```typescript
  notes: {
    /** 写入 Quick Note / Memo 到 Obsidian Vault */
    create: (data: QuickNoteRequest) =>
      apiClient.post<ApiResponse<QuickNoteResponse>>('/inbox/notes', data),

    /** AI 分析笔记 */
    analyze: (data: NoteAnalyzeRequest) =>
      apiClient.post<ApiResponse<NoteAnalyzeResponse>>('/inbox/notes/analyze', data),

    /** 预览笔记合并 */
    consolidatePreview: (data: NoteConsolidatePreviewRequest) =>
      apiClient.post<ApiResponse<NoteConsolidatePreviewResponse>>('/inbox/notes/consolidate/preview', data),

    /** 执行笔记合并写入 */
    consolidateWrite: (data: NoteConsolidateWriteRequest) =>
      apiClient.post<ApiResponse<QuickNoteResponse>>('/inbox/notes/consolidate/write', data),
  },
```

替换为：

```typescript
  notes: {
    /** 写入 Quick Note / Memo 到 Obsidian Vault */
    create: (data: QuickNoteRequest) =>
      apiClient.post<ApiResponse<QuickNoteResponse>>('/inbox/notes', data),

    /** AI 分析笔记 */
    analyze: (data: NoteAnalyzeRequest) =>
      apiClient.post<ApiResponse<NoteAnalyzeResponse>>('/inbox/notes/analyze', data),

    /** 获取指定类型（quick_note/memo）的标签索引列表 */
    tags: (kind: 'quick_note' | 'memo') =>
      apiClient.get<ApiResponse<NoteTagEntry[]>>('/inbox/notes/tags', { params: { kind } }),

    /** 按标题关键词 + 标签筛选笔记，生成 AI 汇总 Markdown */
    summarize: (data: NoteSummarizeRequest) =>
      apiClient.post<ApiResponse<NoteSummarizeResponse>>('/inbox/notes/summarize', data),
  },
```

- [ ] **Step 3: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: 仍报错（`NoteComposer.tsx`、`index.tsx` 等引用旧 API 字段），将在后续任务中修复

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/inbox.api.ts
git commit -m "feat: inbox.api 新增 notes.tags/summarize，移除 consolidate 接口"
```

---

## Task 10: `TagPicker` 标签多选组件

**Files:**
- Create: `frontend/src/pages/Inbox/components/notes/TagPicker.tsx`

- [ ] **Step 1: 创建组件**

```tsx
import { Tag } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { NoteTagEntry } from '../../../../types/domain.types'

export type TagPickerProps = {
  /** 标签索引中的可选标签列表（来自 GET /inbox/notes/tags） */
  availableTags: NoteTagEntry[]
  selectedTags: string[]
  onChange: (tags: string[]) => void
  /** 选中数量上限；笔记录入场景传 3，汇总检索场景不传（不限制） */
  maxTags?: number
}

// 标签多选器：以 chip 形式展示标签索引中的标签，点击切换选中状态；
// 达到 maxTags 上限时，未选中的 chip 置为禁用，防止单篇笔记标签数超限。
export function TagPicker({ availableTags, selectedTags, onChange, maxTags }: TagPickerProps) {
  const toggleTag = (name: string) => {
    if (selectedTags.includes(name)) {
      onChange(selectedTags.filter((t) => t !== name))
      return
    }
    if (maxTags !== undefined && selectedTags.length >= maxTags) return
    onChange([...selectedTags, name])
  }

  if (availableTags.length === 0) {
    return <p className="text-xs text-muted-foreground">暂无可选标签，AI 整理后会自动生成</p>
  }

  const reachedLimit = maxTags !== undefined && selectedTags.length >= maxTags

  return (
    <div className="flex flex-wrap gap-1.5">
      {availableTags.map((tag) => {
        const selected = selectedTags.includes(tag.name)
        const disabled = !selected && reachedLimit
        return (
          <button
            key={tag.name}
            type="button"
            onClick={() => toggleTag(tag.name)}
            disabled={disabled}
            title={tag.description}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent text-accent-foreground hover:bg-accent/80',
              disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            <Tag className="h-2.5 w-2.5" />
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: 不应新增与 `TagPicker.tsx` 相关的错误（仍可能有其它任务未完成导致的既有错误）

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Inbox/components/notes/TagPicker.tsx
git commit -m "feat: 新增 TagPicker 标签多选组件"
```

---

## Task 11: `NoteSummaryPanel` 笔记汇总组件

**Files:**
- Create: `frontend/src/pages/Inbox/components/notes/NoteSummaryPanel.tsx`

- [ ] **Step 1: 创建组件**

```tsx
import { useState } from 'react'
import { Copy, Check, Loader2, FileSearch } from 'lucide-react'
import { TagPicker } from './TagPicker'
import type { NoteTagEntry, NoteSummarizeResponse } from '../../../../types/domain.types'

export type NoteSummaryPanelProps = {
  titleQuery: string
  onTitleQueryChange: (value: string) => void
  availableTags: NoteTagEntry[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onSummarize: () => void
  isSummarizing: boolean
  result: NoteSummarizeResponse | null
}

// 笔记汇总面板：按标题关键词 + 标签多选检索笔记，AI 生成 Markdown 汇总并支持一键复制（不写入文件）
export function NoteSummaryPanel({
  titleQuery,
  onTitleQueryChange,
  availableTags,
  selectedTags,
  onTagsChange,
  onSummarize,
  isSummarizing,
  result,
}: NoteSummaryPanelProps) {
  const [copied, setCopied] = useState(false)

  // 标题关键词和标签至少需要一项，否则后端会跳过扫描直接返回空结果
  const canSummarize = titleQuery.trim().length > 0 || selectedTags.length > 0

  const handleCopy = async () => {
    if (!result?.markdown) return
    await navigator.clipboard.writeText(result.markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-3">
      <div className="flex items-center gap-1.5">
        <FileSearch className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold text-foreground">笔记汇总</span>
      </div>

      <input
        value={titleQuery}
        onChange={(e) => onTitleQueryChange(e.target.value)}
        placeholder="按标题关键词筛选…"
        className="nexus-input w-full px-3 py-1.5 text-sm"
      />

      {/* 汇总检索场景的标签多选不限制数量，与笔记录入的 maxTags=3 区分 */}
      <TagPicker availableTags={availableTags} selectedTags={selectedTags} onChange={onTagsChange} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSummarize}
          disabled={!canSummarize || isSummarizing}
          className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {isSummarizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSearch className="h-3.5 w-3.5" />
          )}
          生成汇总
        </button>
      </div>

      {result && (
        result.matchedCount === 0 ? (
          <p className="text-xs text-muted-foreground">未找到匹配笔记</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">匹配到 {result.matchedCount} 篇笔记</span>
              <button
                type="button"
                onClick={handleCopy}
                className="nexus-button-utility flex items-center gap-1 px-2 py-1 text-[11px]"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
              {result.markdown}
            </div>
          </div>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: 不应新增与 `NoteSummaryPanel.tsx` 相关的错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Inbox/components/notes/NoteSummaryPanel.tsx
git commit -m "feat: 新增 NoteSummaryPanel 笔记汇总组件"
```

---

## Task 12: 重写 `NoteComposer.tsx`

**Files:**
- Modify: `frontend/src/pages/Inbox/components/notes/NoteComposer.tsx`

二级 Tab（速记/备忘录）已固定 `kind`，移除类型切换分段控件与自由文本标签输入，接入 `TagPicker`（`maxTags=3`）。

- [ ] **Step 1: 替换整个文件内容**

```tsx
import { useState } from 'react'
import { Save, Loader2, Sparkles, EyeOff, Trash2, FileText, ChevronDown } from 'lucide-react'
import { cn, formatLocalDateTimeForTitle } from '../../../../lib/utils'
import { TagPicker } from './TagPicker'
import type { NoteAnalyzeResponse, NoteTagEntry } from '../../../../types/domain.types'

export type NoteComposerProps = {
  title: string
  content: string
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  availableTags: NoteTagEntry[]
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onSave: () => void
  onAnalyze: () => void
  aiSuggestion: NoteAnalyzeResponse | null
  onApplySuggestion: () => void
  isSaving: boolean
  isAnalyzing: boolean
  aiAvailable: boolean
  onClearDraft: () => void
}

/** 标题模板：应用后只覆盖标题，不影响内容/标签 */
const TITLE_TEMPLATES = ['Quick Note', 'Memo', 'Meeting Notes', 'Idea'] as const

// 笔记编辑器：标题（含模板）+ 内容 + 标签选择（TagPicker，上限 3 个）+ AI 整理 + 保存。
// kind 已由外层二级 Tab 固定，不再提供类型切换控件。
export function NoteComposer({
  title,
  content,
  selectedTags,
  onTagsChange,
  availableTags,
  onTitleChange,
  onContentChange,
  onSave,
  onAnalyze,
  aiSuggestion,
  onApplySuggestion,
  isSaving,
  isAnalyzing,
  aiAvailable,
  onClearDraft,
}: NoteComposerProps) {
  const [showTemplates, setShowTemplates] = useState(false)

  const handleApplyTemplate = (label: string) => {
    onTitleChange(`${label} - ${formatLocalDateTimeForTitle()}`)
    setShowTemplates(false)
  }

  const handleClear = () => {
    if (title.trim() || content.trim() || selectedTags.length > 0) {
      if (!window.confirm('清空当前草稿？')) return
    }
    onClearDraft()
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave() }}
      className="space-y-3"
    >
      {/* 编辑区 */}
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-2">
        <div className="flex items-center gap-1.5">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="标题（可选）"
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
          {/* 标题模板：应用后用「模板名 - 可读日期时间」覆盖标题，不影响正文/标签 */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="nexus-button-utility flex items-center gap-1 px-2.5 py-1.5 text-xs"
              title="使用标题模板"
            >
              <FileText className="h-3.5 w-3.5" />
              模板
              <ChevronDown className="h-3 w-3" />
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
                {TITLE_TEMPLATES.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleApplyTemplate(label)}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
                  >
                    {label} - {formatLocalDateTimeForTitle()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="记下你的想法…"
          rows={6}
          className="nexus-input w-full px-3 py-2 text-sm resize-none"
        />

        {/* 标签区：从标签索引中选择，最多 3 个；新标签只能通过 AI 建议引入 */}
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">标签（最多 3 个）</p>
          <TagPicker availableTags={availableTags} selectedTags={selectedTags} onChange={onTagsChange} maxTags={3} />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClear}
            className="nexus-button-utility flex items-center gap-1.5 px-2.5 text-xs mr-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空
          </button>

          {aiAvailable && (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={!content.trim() || isAnalyzing}
              title="根据当前内容生成标题、标签和整理后的 Markdown"
              className={cn(
                'flex items-center gap-1.5 h-9 md:h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                'text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-50',
              )}
            >
              {isAnalyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI 整理
            </button>
          )}

          {!aiAvailable && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <EyeOff className="h-3 w-3" />
              AI 未启用
            </span>
          )}

          {aiSuggestion && (
            <button
              type="button"
              onClick={onApplySuggestion}
              className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              合并到当前笔记
            </button>
          )}

          <button
            type="submit"
            disabled={!content.trim() || isSaving}
            className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            保存原文
          </button>
        </div>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: `NoteComposer.tsx` 自身类型正确；引用方（`index.tsx`/`InboxDesktopView.tsx`/`InboxMobileView.tsx`）会因 props 变化报错，将在 Task 13-16 中修复

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Inbox/components/notes/NoteComposer.tsx
git commit -m "refactor: NoteComposer 移除类型切换与自由文本标签，接入 TagPicker"
```

---

## Task 13: 提取 `mergeNoteContent` 工具函数 + 新增 `useNoteSection` Hook

**Files:**
- Create: `frontend/src/pages/Inbox/utils/noteMerge.ts`
- Create: `frontend/src/pages/Inbox/hooks/useNoteSection.ts`

`mergeNoteContent`（及其内部依赖的 `normalizeForCompare`/`jaccardSimilarity`）当前定义在 `index.tsx`，仅供笔记草稿合并使用，迁出后供 `useNoteSection` 引用。`useNoteSection(kind)` 封装速记/备忘录单个分区的全部状态：草稿编辑、AI 分析与应用建议、保存（含标签索引写回）、标签索引拉取、汇总检索。

- [ ] **Step 1: 创建 `noteMerge.ts`**

```typescript
/** 归一化文本用于比较：合并连续空白、去除首尾空白、转小写。 */
function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** 计算两段归一化文本按词的 Jaccard 相似度，用于判断段落是否重复。 */
function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(Boolean))
  const tokensB = new Set(b.split(' ').filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  let intersection = 0
  for (const t of tokensA) if (tokensB.has(t)) intersection++
  const union = new Set([...tokensA, ...tokensB]).size
  return union === 0 ? 0 : intersection / union
}

/**
 * 合并 AI 整理结果到当前笔记正文，采用保守策略。
 * 原因：AI 建议应用后若当前笔记已有类似原文，重复追加会导致笔记内容不断膨胀重复，
 * 因此只在建议内容明显不同于现有段落时才追加，宁可漏合并也不重复。
 */
export function mergeNoteContent(current: string, suggested?: string): string {
  if (!suggested || !suggested.trim()) return current

  const normCurrent = normalizeForCompare(current)
  const normSuggested = normalizeForCompare(suggested)
  if (!normCurrent) return suggested
  // 建议文本已包含当前全部内容（如 AI 重新整理了全文）：直接采用建议文本
  if (normSuggested.includes(normCurrent)) return suggested
  // 当前内容已包含建议文本：保持当前内容不变
  if (normCurrent.includes(normSuggested)) return current

  const currentParagraphs = current.split(/\n\s*\n/).map((p) => normalizeForCompare(p)).filter(Boolean)
  const suggestedParagraphs = suggested.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  const newParagraphs = suggestedParagraphs.filter((p) => {
    const normP = normalizeForCompare(p)
    return !currentParagraphs.some((cp) => jaccardSimilarity(cp, normP) >= 0.75)
  })

  if (newParagraphs.length === 0) return current
  return [current.trimEnd(), ...newParagraphs].join('\n\n')
}
```

- [ ] **Step 2: 创建 `useNoteSection.ts`**

```typescript
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inboxApi } from '../../../api/inbox.api'
import { mergeNoteContent } from '../utils/noteMerge'
import type {
  NoteAnalyzeResponse,
  NoteTagEntry,
  NoteSummarizeResponse,
  QuickNoteResponse,
} from '../../../types/domain.types'

/**
 * 封装速记 / 备忘录单个分区（kind 固定）的全部状态与请求逻辑：
 * 草稿编辑、AI 分析与应用建议、保存（含标签索引写回）、标签索引拉取、笔记汇总检索。
 * 速记和备忘录分别调用一次该 hook，状态完全隔离。
 */
export function useNoteSection(kind: 'quick_note' | 'memo') {
  const qc = useQueryClient()

  // ==================== 草稿编辑状态 ====================
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  // AI 分析返回的新建标签说明，随保存请求一起提交，由后端写回标签索引文件
  const [newTagDescriptions, setNewTagDescriptions] = useState<Record<string, string>>({})
  const [lastResult, setLastResult] = useState<QuickNoteResponse | null>(null)

  // ==================== 标签索引 ====================
  const tagsQuery = useQuery({
    queryKey: ['inbox', 'notes', 'tags', kind],
    queryFn: () => inboxApi.notes.tags(kind),
  })
  const indexedTags = tagsQuery.data?.data?.data ?? []

  // AI 本次建议的新标签：写回索引前也需要在 TagPicker 中可见/可勾选，因此先合入本地可选列表
  const [pendingNewTags, setPendingNewTags] = useState<NoteTagEntry[]>([])
  const availableTags: NoteTagEntry[] = [
    ...indexedTags,
    ...pendingNewTags.filter((t) => !indexedTags.some((e) => e.name === t.name)),
  ]

  // ==================== AI 分析 ====================
  const [aiResult, setAiResult] = useState<NoteAnalyzeResponse | null>(null)

  const analyzeMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.analyze>[0]) => inboxApi.notes.analyze(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setAiResult(result)
    },
  })

  const onAnalyze = () => {
    analyzeMutation.mutate({
      content,
      title: title || undefined,
      kind,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    })
  }

  const resetAnalyze = () => setAiResult(null)

  // 应用 AI 建议：覆盖标题、采用建议标签（截断至 3）、保守合并整理后的正文；
  // AI 新建的标签先加入本地可选列表供勾选，真正写回索引在保存时发生
  const onApplySuggestion = () => {
    if (!aiResult) return
    if (aiResult.suggestedTitle) setTitle(aiResult.suggestedTitle)
    if (aiResult.suggestedTags) setSelectedTags(aiResult.suggestedTags.slice(0, 3))
    if (aiResult.cleanedMarkdown) {
      setContent((prev) => mergeNoteContent(prev, aiResult.cleanedMarkdown))
    }
    if (aiResult.newTagDescriptions && Object.keys(aiResult.newTagDescriptions).length > 0) {
      setNewTagDescriptions(aiResult.newTagDescriptions)
      setPendingNewTags(
        Object.entries(aiResult.newTagDescriptions).map(([name, description]) => ({ name, description })),
      )
    }
    setAiResult(null)
  }

  // ==================== 保存 ====================
  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.create>[0]) => inboxApi.notes.create(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setLastResult(result)
      // 保存成功后标签索引可能新增了标签，刷新供 TagPicker 使用
      qc.invalidateQueries({ queryKey: ['inbox', 'notes', 'tags', kind] })
    },
  })

  const onSave = () => {
    setLastResult(null)
    saveMutation.mutate({
      content,
      title: title || undefined,
      kind,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      newTagDescriptions: Object.keys(newTagDescriptions).length > 0 ? newTagDescriptions : undefined,
    })
  }

  const saveError = saveMutation.isError
    ? (saveMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (saveMutation.error as Error)?.message || '保存失败'
    : undefined

  // Obsidian 配置状态：通过笔记保存错误码判断
  const obsidianConfigured = saveMutation.error
    ? (saveMutation.error as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode !== 'OBSIDIAN_NOT_CONFIGURED'
    : true

  // 一键清空草稿：标题/内容/标签/AI 建议/上次保存结果一并清空
  const onClearDraft = () => {
    setTitle('')
    setContent('')
    setSelectedTags([])
    setNewTagDescriptions({})
    setPendingNewTags([])
    setAiResult(null)
    setLastResult(null)
  }

  // ==================== 汇总检索 ====================
  const [summaryTitleQuery, setSummaryTitleQuery] = useState('')
  const [summaryTags, setSummaryTags] = useState<string[]>([])
  const [summaryResult, setSummaryResult] = useState<NoteSummarizeResponse | null>(null)

  const summarizeMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.summarize>[0]) => inboxApi.notes.summarize(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setSummaryResult(result)
    },
  })

  const onSummarize = () => {
    summarizeMutation.mutate({
      kind,
      titleQuery: summaryTitleQuery || undefined,
      tags: summaryTags.length > 0 ? summaryTags : undefined,
    })
  }

  return {
    kind,
    // 录入区
    title,
    content,
    selectedTags,
    onTitleChange: setTitle,
    onContentChange: setContent,
    onTagsChange: setSelectedTags,
    availableTags,
    // AI 可用性：默认 true，具体可用性由后端接口判断
    aiAvailable: true,
    aiResult,
    isAnalyzing: analyzeMutation.isPending,
    onAnalyze,
    onApplySuggestion,
    resetAnalyze,
    // 保存
    onSave,
    isSaving: saveMutation.isPending,
    saveError,
    obsidianConfigured,
    lastResult,
    onClearResult: () => setLastResult(null),
    onClearDraft,
    // 汇总区
    summaryTitleQuery,
    onSummaryTitleQueryChange: setSummaryTitleQuery,
    summaryTags,
    onSummaryTagsChange: setSummaryTags,
    onSummarize,
    isSummarizing: summarizeMutation.isPending,
    summaryResult,
  }
}

export type NoteSectionState = ReturnType<typeof useNoteSection>
```

- [ ] **Step 3: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: `noteMerge.ts`/`useNoteSection.ts` 本身无类型错误；`index.tsx` 仍报旧代码相关错误，将在 Task 14 修复

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Inbox/utils/noteMerge.ts frontend/src/pages/Inbox/hooks/useNoteSection.ts
git commit -m "feat: 新增 useNoteSection hook 封装速记/备忘录分区状态"
```

---

## Task 14: 重构 `index.tsx`，接入 `useNoteSection`

**Files:**
- Modify: `frontend/src/pages/Inbox/index.tsx`

移除原有单一笔记状态（`noteContent`/`noteTitle`/`noteTags`/`noteKind`/`noteAiResult`/`saveNoteMutation`/`analyzeNoteMutation`/`mergeNoteContent` 等），改为调用两次 `useNoteSection`，并将 `noteProps` 拆分为 `quickNoteProps`/`memoProps` 传给桌面/移动视图。

- [ ] **Step 1: 更新顶部 import**

将：

```typescript
import type {
  Bookmark, QuickNoteResponse,
  BookmarkAnalyzeResponse, BookmarkSmartGroup, BookmarkSmartGroupRequest,
  BookmarkImportPreviewResponse, BookmarkImportCommitRequest,
  NoteAnalyzeResponse,
  ImportAction, ImportDecision, BookmarkGroupPreviewResponse,
} from '../../types/domain.types'
import type { InboxTab } from './inbox.shared'
import { InboxDesktopView } from './InboxDesktopView'
import { InboxMobileView } from './InboxMobileView'
```

替换为：

```typescript
import type {
  Bookmark,
  BookmarkAnalyzeResponse, BookmarkSmartGroup, BookmarkSmartGroupRequest,
  BookmarkImportPreviewResponse, BookmarkImportCommitRequest,
  ImportAction, ImportDecision, BookmarkGroupPreviewResponse,
} from '../../types/domain.types'
import type { InboxTab } from './inbox.shared'
import { InboxDesktopView } from './InboxDesktopView'
import { InboxMobileView } from './InboxMobileView'
import { useNoteSection } from './hooks/useNoteSection'
```

- [ ] **Step 2: 删除 `mergeNoteContent`/`normalizeForCompare`/`jaccardSimilarity` 定义**

这三个函数已迁移到 `frontend/src/pages/Inbox/utils/noteMerge.ts`（Task 13）。删除从 `/** 归一化文本用于比较...` 到 `mergeNoteContent` 函数结尾（直到 `export default function InboxPage()` 前一行的注释 `// InboxPage 承载...`）的整段代码，即删除：

```typescript
/** 归一化文本用于比较：合并连续空白、去除首尾空白、转小写。 */
function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** 计算两段归一化文本按词的 Jaccard 相似度，用于判断段落是否重复。 */
function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(Boolean))
  const tokensB = new Set(b.split(' ').filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  let intersection = 0
  for (const t of tokensA) if (tokensB.has(t)) intersection++
  const union = new Set([...tokensA, ...tokensB]).size
  return union === 0 ? 0 : intersection / union
}

/**
 * 合并 AI 整理结果到当前笔记正文，采用保守策略。
 * 原因：AI 建议应用后若当前笔记已有类似原文，重复追加会导致笔记内容不断膨胀重复，
 * 因此只在建议内容明显不同于现有段落时才追加，宁可漏合并也不重复。
 */
export function mergeNoteContent(current: string, suggested?: string): string {
  if (!suggested || !suggested.trim()) return current

  const normCurrent = normalizeForCompare(current)
  const normSuggested = normalizeForCompare(suggested)
  if (!normCurrent) return suggested
  // 建议文本已包含当前全部内容（如 AI 重新整理了全文）：直接采用建议文本
  if (normSuggested.includes(normCurrent)) return suggested
  // 当前内容已包含建议文本：保持当前内容不变
  if (normCurrent.includes(normSuggested)) return current

  const currentParagraphs = current.split(/\n\s*\n/).map((p) => normalizeForCompare(p)).filter(Boolean)
  const suggestedParagraphs = suggested.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  const newParagraphs = suggestedParagraphs.filter((p) => {
    const normP = normalizeForCompare(p)
    return !currentParagraphs.some((cp) => jaccardSimilarity(cp, normP) >= 0.75)
  })

  if (newParagraphs.length === 0) return current
  return [current.trimEnd(), ...newParagraphs].join('\n\n')
}
```

- [ ] **Step 3: 替换"笔记状态"整段**

将（含注释行 `// ==================== 笔记状态 ====================` 到 `clearNoteDraft` 定义结尾）：

```typescript
  // ==================== 笔记状态 ====================
  const [lastNoteResult, setLastNoteResult] = useState<QuickNoteResponse | null>(null)

  const saveNoteMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.create>[0]) => inboxApi.notes.create(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setLastNoteResult(result)
    },
  })

  // 笔记编辑器状态
  const [noteContent, setNoteContent] = useState('')
  const [noteKind, setNoteKind] = useState<'quick_note' | 'memo'>('quick_note')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteTags, setNoteTags] = useState<string[]>([])

  // 笔记 AI 分析
  const [noteAiResult, setNoteAiResult] = useState<NoteAnalyzeResponse | null>(null)

  const analyzeNoteMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.analyze>[0]) =>
      inboxApi.notes.analyze(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setNoteAiResult(result)
    },
  })

  const resetNoteAnalyze = () => {
    setNoteAiResult(null)
  }

  // 一键清空 Quick Note / Memo 草稿：标题/内容/标签/AI 建议/上次保存结果一并清空，kind 保持当前选择
  const clearNoteDraft = () => {
    setNoteTitle('')
    setNoteContent('')
    setNoteTags([])
    setNoteAiResult(null)
    setLastNoteResult(null)
  }
```

替换为：

```typescript
  // ==================== 笔记状态 ====================
  // 速记 / 备忘录状态完全隔离，分别由各自的 useNoteSection 实例管理
  const quickNoteSection = useNoteSection('quick_note')
  const memoSection = useNoteSection('memo')
```

- [ ] **Step 4: 删除 `obsidianConfigured` 计算**

将：

```typescript
  // AI 可用性：默认 true，具体可用性由后端接口判断
  const aiAvailable = true

  // Obsidian 配置状态：通过笔记保存错误判断
  const obsidianConfigured = saveNoteMutation.error
    ? (saveNoteMutation.error as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode !== 'OBSIDIAN_NOT_CONFIGURED'
    : true

  // 错误信息提取
```

替换为：

```typescript
  // AI 可用性：默认 true，具体可用性由后端接口判断
  const aiAvailable = true

  // 错误信息提取
```

- [ ] **Step 5: 删除 `noteError` 计算**

将：

```typescript
  const uploadError = uploadDocumentMutation.isError
    ? (uploadDocumentMutation.error as Error)?.message || '上传失败'
    : undefined
  const noteError = saveNoteMutation.isError
    ? (saveNoteMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (saveNoteMutation.error as Error)?.message || '保存失败'
    : undefined

  // ==================== Props 组装 ====================
```

替换为：

```typescript
  const uploadError = uploadDocumentMutation.isError
    ? (uploadDocumentMutation.error as Error)?.message || '上传失败'
    : undefined

  // ==================== Props 组装 ====================
```

- [ ] **Step 6: 替换 `noteProps` 与最终渲染**

将文件末尾的：

```typescript
  const noteProps = {
    // 编辑器状态
    noteContent,
    noteTitle,
    noteTags,
    noteKind,
    onContentChange: setNoteContent,
    onTitleChange: setNoteTitle,
    onTagsChange: setNoteTags,
    onKindChange: setNoteKind,
    aiAvailable,
    // AI 分析
    onAnalyze: (data: Parameters<typeof inboxApi.notes.analyze>[0]) => analyzeNoteMutation.mutate(data),
    noteAiResult,
    isAnalyzing: analyzeNoteMutation.isPending,
    onApplySuggestion: (suggestion: NoteAnalyzeResponse) => {
      if (suggestion.suggestedTitle) setNoteTitle(suggestion.suggestedTitle)
      if (suggestion.suggestedKind) setNoteKind(suggestion.suggestedKind as 'quick_note' | 'memo')
      if (suggestion.suggestedTags) setNoteTags(suggestion.suggestedTags)
      // 保守合并整理后的 Markdown，避免与现有正文产生重复段落
      if (suggestion.cleanedMarkdown) {
        setNoteContent((prev) => mergeNoteContent(prev, suggestion.cleanedMarkdown))
      }
      setNoteAiResult(null)
    },
    resetAnalyze: resetNoteAnalyze,
    // 原有
    obsidianConfigured,
    onSave: () => {
      setLastNoteResult(null)
      saveNoteMutation.mutate({
        content: noteContent,
        title: noteTitle || undefined,
        kind: noteKind,
        tags: noteTags.length > 0 ? noteTags : undefined,
      })
    },
    isSaving: saveNoteMutation.isPending,
    saveError: noteError,
    lastResult: lastNoteResult,
    onClearResult: () => setLastNoteResult(null),
    onClearDraft: clearNoteDraft,
  }

  return (
    <>
      <InboxDesktopView
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bookmarkProps={bookmarkProps}
        documentProps={documentProps}
        noteProps={noteProps}
      />
      <InboxMobileView
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bookmarkProps={bookmarkProps}
        documentProps={documentProps}
        noteProps={noteProps}
      />
    </>
  )
}
```

替换为：

```typescript
  return (
    <>
      <InboxDesktopView
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bookmarkProps={bookmarkProps}
        documentProps={documentProps}
        quickNoteProps={quickNoteSection}
        memoProps={memoSection}
      />
      <InboxMobileView
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bookmarkProps={bookmarkProps}
        documentProps={documentProps}
        quickNoteProps={quickNoteSection}
        memoProps={memoSection}
      />
    </>
  )
}
```

- [ ] **Step 7: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: `index.tsx` 自身不再报错；`InboxDesktopView.tsx`/`InboxMobileView.tsx` 因 props 签名变化（`noteProps` → `quickNoteProps`/`memoProps`）报错，将在 Task 15-16 修复

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Inbox/index.tsx
git commit -m "refactor: index.tsx 接入 useNoteSection，拆分速记/备忘录 props"
```

---

## Task 15: 重构 `InboxDesktopView.tsx`，新增速记/备忘录二级 Tab

**Files:**
- Modify: `frontend/src/pages/Inbox/InboxDesktopView.tsx`

- [ ] **Step 1: 更新顶部 import**

将：

```typescript
import { Upload, Folder, FileText, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import { INBOX_TABS, type InboxTab } from './inbox.shared'
import { BookmarkPanel } from './components/BookmarkPanel'
import { BookmarkCaptureBar } from './components/bookmarks/BookmarkCaptureBar'
import { BookmarkAiReviewPanel } from './components/bookmarks/BookmarkAiReviewPanel'
import { BookmarkImportDrawer } from './components/bookmarks/BookmarkImportDrawer'
import { BookmarkSmartGroupPanel } from './components/bookmarks/BookmarkSmartGroupPanel'
import { PaperlessGateway } from './components/documents/PaperlessGateway'
import { NoteComposer } from './components/notes/NoteComposer'
import { NoteAiSuggestionPanel } from './components/notes/NoteAiSuggestionPanel'
import type {
  BookmarkAnalyzeResponse, BookmarkSmartGroup, BookmarkSmartGroupRequest,
  BookmarkImportPreviewResponse, NoteAnalyzeResponse, ImportAction, MatchedBookmark,
  Paginated, Bookmark, InboxDocument,
} from '../../types/domain.types'
```

替换为：

```typescript
import { useState } from 'react'
import { Upload, Folder, FileText, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import { INBOX_TABS, type InboxTab } from './inbox.shared'
import { BookmarkPanel } from './components/BookmarkPanel'
import { BookmarkCaptureBar } from './components/bookmarks/BookmarkCaptureBar'
import { BookmarkAiReviewPanel } from './components/bookmarks/BookmarkAiReviewPanel'
import { BookmarkImportDrawer } from './components/bookmarks/BookmarkImportDrawer'
import { BookmarkSmartGroupPanel } from './components/bookmarks/BookmarkSmartGroupPanel'
import { PaperlessGateway } from './components/documents/PaperlessGateway'
import { NoteComposer } from './components/notes/NoteComposer'
import { NoteAiSuggestionPanel } from './components/notes/NoteAiSuggestionPanel'
import { NoteSummaryPanel } from './components/notes/NoteSummaryPanel'
import type { NoteSectionState } from './hooks/useNoteSection'
import type {
  BookmarkAnalyzeResponse, BookmarkSmartGroup, BookmarkSmartGroupRequest,
  BookmarkImportPreviewResponse, ImportAction, MatchedBookmark,
  Paginated, Bookmark, InboxDocument,
} from '../../types/domain.types'

/** 笔记二级 Tab：速记 / 备忘录，结构完全对称，仅 kind 不同。导出供 InboxMobileView 复用 */
export const NOTE_SECTIONS: { key: 'quick_note' | 'memo'; label: string }[] = [
  { key: 'quick_note', label: '速记' },
  { key: 'memo', label: '备忘录' },
]
```

- [ ] **Step 2: 替换 `InboxDesktopNoteProps` 类型**

将：

```typescript
export type InboxDesktopNoteProps = {
  noteContent: string
  noteTitle: string
  noteTags: string[]
  noteKind: 'quick_note' | 'memo'
  onContentChange: (v: string) => void
  onTitleChange: (v: string) => void
  onTagsChange: (v: string[]) => void
  onKindChange: (v: 'quick_note' | 'memo') => void
  aiAvailable: boolean
  onAnalyze: (data: { title?: string; content: string; kind?: string; tags?: string[] }) => void
  noteAiResult: NoteAnalyzeResponse | null
  isAnalyzing: boolean
  onApplySuggestion: (suggestion: NoteAnalyzeResponse) => void
  resetAnalyze: () => void
  obsidianConfigured: boolean
  onSave: () => void
  isSaving: boolean
  saveError?: string
  lastResult: { relativePath: string } | null
  onClearResult: () => void
  onClearDraft: () => void
}
```

替换为：

```typescript
/** 速记 / 备忘录单个分区的全部 props，来自 useNoteSection 的返回值 */
export type NoteSectionProps = NoteSectionState
```

- [ ] **Step 3: 更新 `InboxDesktopViewProps` 与函数签名**

将：

```typescript
export type InboxDesktopViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: InboxDesktopBookmarkProps
  documentProps: InboxDesktopDocumentProps
  noteProps: InboxDesktopNoteProps
}

// InboxDesktopView 承载 Inbox 桌面端三栏 tab 面板布局，集成新 Phase 3.1 组件。
export function InboxDesktopView({
  activeTab,
  onTabChange,
  bookmarkProps: bp,
  documentProps: dp,
  noteProps: np,
}: InboxDesktopViewProps) {
  return (
```

替换为：

```typescript
export type InboxDesktopViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: InboxDesktopBookmarkProps
  documentProps: InboxDesktopDocumentProps
  quickNoteProps: NoteSectionProps
  memoProps: NoteSectionProps
}

// InboxDesktopView 承载 Inbox 桌面端三栏 tab 面板布局，集成新 Phase 3.1 组件。
export function InboxDesktopView({
  activeTab,
  onTabChange,
  bookmarkProps: bp,
  documentProps: dp,
  quickNoteProps,
  memoProps,
}: InboxDesktopViewProps) {
  // 笔记 Tab 内的二级 Tab：速记 / 备忘录，默认显示速记
  const [activeNoteSection, setActiveNoteSection] = useState<'quick_note' | 'memo'>('quick_note')
  const ns = activeNoteSection === 'quick_note' ? quickNoteProps : memoProps

  return (
```

- [ ] **Step 4: 替换"笔记"Tab 渲染区块**

将：

```tsx
        {activeTab === 'notes' && (
          <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4">
            <div className="min-w-0">
            <NoteComposer
              kind={np.noteKind}
              title={np.noteTitle}
              content={np.noteContent}
              tags={np.noteTags}
              onKindChange={np.onKindChange}
              onTitleChange={np.onTitleChange}
              onContentChange={np.onContentChange}
              onAddTag={(tag) => np.onTagsChange([...np.noteTags, tag])}
              onRemoveTag={(tag) => np.onTagsChange(np.noteTags.filter((t) => t !== tag))}
              onSave={np.onSave}
              onAnalyze={() => np.onAnalyze({
                content: np.noteContent,
                title: np.noteTitle || undefined,
                kind: np.noteKind,
                tags: np.noteTags.length > 0 ? np.noteTags : undefined,
              })}
              aiSuggestion={np.noteAiResult}
              onApplySuggestion={() => {
                if (np.noteAiResult) np.onApplySuggestion(np.noteAiResult!)
              }}
              isSaving={np.isSaving}
              isAnalyzing={np.isAnalyzing}
              aiAvailable={np.aiAvailable}
              onClearDraft={np.onClearDraft}
            />
            </div>

            <aside className="space-y-3">
              <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-extrabold text-foreground">AI 建议</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  先写原文，再让 AI 生成标题、标签、目录和整理后的 Markdown。建议只会在你确认后应用。
                </p>
              </div>
            {np.noteAiResult ? (
              <NoteAiSuggestionPanel
                suggestion={np.noteAiResult}
                onApply={() => np.onApplySuggestion(np.noteAiResult!)}
                onDismiss={np.resetAnalyze}
              />
            ) : (
              <div className="rounded-lg border border-dashed bg-card/60 p-4 text-center text-xs text-muted-foreground">
                暂无建议
              </div>
            )}
            </aside>
          </div>
        )}
```

替换为：

```tsx
        {activeTab === 'notes' && (
          <div className="space-y-3">
            {/* 速记 / 备忘录 二级 Tab：结构完全对称，仅 kind 不同 */}
            <div className="grid max-w-xs grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1">
              {NOTE_SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveNoteSection(section.key)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-bold transition-colors',
                    activeNoteSection === section.key
                      ? 'bg-card text-foreground shadow-[var(--shadow-xs)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {section.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4">
              <div className="min-w-0 space-y-3">
                <NoteComposer
                  title={ns.title}
                  content={ns.content}
                  selectedTags={ns.selectedTags}
                  onTagsChange={ns.onTagsChange}
                  availableTags={ns.availableTags}
                  onTitleChange={ns.onTitleChange}
                  onContentChange={ns.onContentChange}
                  onSave={ns.onSave}
                  onAnalyze={ns.onAnalyze}
                  aiSuggestion={ns.aiResult}
                  onApplySuggestion={ns.onApplySuggestion}
                  isSaving={ns.isSaving}
                  isAnalyzing={ns.isAnalyzing}
                  aiAvailable={ns.aiAvailable}
                  onClearDraft={ns.onClearDraft}
                />

                <NoteSummaryPanel
                  titleQuery={ns.summaryTitleQuery}
                  onTitleQueryChange={ns.onSummaryTitleQueryChange}
                  availableTags={ns.availableTags}
                  selectedTags={ns.summaryTags}
                  onTagsChange={ns.onSummaryTagsChange}
                  onSummarize={ns.onSummarize}
                  isSummarizing={ns.isSummarizing}
                  result={ns.summaryResult}
                />
              </div>

              <aside className="space-y-3">
                <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-extrabold text-foreground">AI 建议</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    先写原文，再让 AI 生成标题、标签和整理后的 Markdown。建议只会在你确认后应用。
                  </p>
                </div>
                {ns.aiResult ? (
                  <NoteAiSuggestionPanel
                    suggestion={ns.aiResult}
                    onApply={ns.onApplySuggestion}
                    onDismiss={ns.resetAnalyze}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed bg-card/60 p-4 text-center text-xs text-muted-foreground">
                    暂无建议
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}
```

- [ ] **Step 5: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: `InboxDesktopView.tsx` 自身无类型错误；`InboxMobileView.tsx` 因导入 `InboxDesktopNoteProps`（已删除）报错，将在 Task 16 修复

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Inbox/InboxDesktopView.tsx
git commit -m "refactor: InboxDesktopView 新增速记/备忘录二级 Tab 与汇总面板"
```

---

## Task 16: 重构 `InboxMobileView.tsx`，新增速记/备忘录二级 Tab

**Files:**
- Modify: `frontend/src/pages/Inbox/InboxMobileView.tsx`

- [ ] **Step 1: 更新顶部 import**

将：

```typescript
import { Upload } from 'lucide-react'
import { cn } from '../../lib/utils'
import { INBOX_TABS, type InboxTab } from './inbox.shared'
import { BookmarkPanel } from './components/BookmarkPanel'
import { BookmarkCaptureBar } from './components/bookmarks/BookmarkCaptureBar'
import { BookmarkAiReviewPanel } from './components/bookmarks/BookmarkAiReviewPanel'
import { BookmarkImportDrawer } from './components/bookmarks/BookmarkImportDrawer'
import { BookmarkSmartGroupPanel } from './components/bookmarks/BookmarkSmartGroupPanel'
import { PaperlessGateway } from './components/documents/PaperlessGateway'
import { NoteComposer } from './components/notes/NoteComposer'
import { NoteAiSuggestionPanel } from './components/notes/NoteAiSuggestionPanel'
import type {
  InboxDesktopBookmarkProps, InboxDesktopDocumentProps, InboxDesktopNoteProps,
} from './InboxDesktopView'

export type InboxMobileViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: InboxDesktopBookmarkProps
  documentProps: InboxDesktopDocumentProps
  noteProps: InboxDesktopNoteProps
}

// InboxMobileView 承载 Inbox 移动端紧凑布局，集成新 Phase 3.1 组件。
export function InboxMobileView({
  activeTab,
  onTabChange,
  bookmarkProps: bp,
  documentProps: dp,
  noteProps: np,
}: InboxMobileViewProps) {
  return (
```

替换为：

```typescript
import { useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '../../lib/utils'
import { INBOX_TABS, type InboxTab } from './inbox.shared'
import { BookmarkPanel } from './components/BookmarkPanel'
import { BookmarkCaptureBar } from './components/bookmarks/BookmarkCaptureBar'
import { BookmarkAiReviewPanel } from './components/bookmarks/BookmarkAiReviewPanel'
import { BookmarkImportDrawer } from './components/bookmarks/BookmarkImportDrawer'
import { BookmarkSmartGroupPanel } from './components/bookmarks/BookmarkSmartGroupPanel'
import { PaperlessGateway } from './components/documents/PaperlessGateway'
import { NoteComposer } from './components/notes/NoteComposer'
import { NoteAiSuggestionPanel } from './components/notes/NoteAiSuggestionPanel'
import { NoteSummaryPanel } from './components/notes/NoteSummaryPanel'
import {
  NOTE_SECTIONS,
  type InboxDesktopBookmarkProps, type InboxDesktopDocumentProps, type NoteSectionProps,
} from './InboxDesktopView'

export type InboxMobileViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: InboxDesktopBookmarkProps
  documentProps: InboxDesktopDocumentProps
  quickNoteProps: NoteSectionProps
  memoProps: NoteSectionProps
}

// InboxMobileView 承载 Inbox 移动端紧凑布局，集成新 Phase 3.1 组件。
export function InboxMobileView({
  activeTab,
  onTabChange,
  bookmarkProps: bp,
  documentProps: dp,
  quickNoteProps,
  memoProps,
}: InboxMobileViewProps) {
  // 笔记 Tab 内的二级 Tab：速记 / 备忘录，默认显示速记
  const [activeNoteSection, setActiveNoteSection] = useState<'quick_note' | 'memo'>('quick_note')
  const ns = activeNoteSection === 'quick_note' ? quickNoteProps : memoProps

  return (
```

- [ ] **Step 2: 替换"笔记"Tab 渲染区块**

将：

```tsx
      {activeTab === 'notes' && (
        <div className="space-y-3">
          <NoteComposer
            kind={np.noteKind}
            title={np.noteTitle}
            content={np.noteContent}
            tags={np.noteTags}
            onKindChange={np.onKindChange}
            onTitleChange={np.onTitleChange}
            onContentChange={np.onContentChange}
            onAddTag={(tag) => np.onTagsChange([...np.noteTags, tag])}
            onRemoveTag={(tag) => np.onTagsChange(np.noteTags.filter((t) => t !== tag))}
            onSave={np.onSave}
            onAnalyze={() => np.onAnalyze({
              content: np.noteContent,
              title: np.noteTitle || undefined,
              kind: np.noteKind,
              tags: np.noteTags.length > 0 ? np.noteTags : undefined,
            })}
            aiSuggestion={np.noteAiResult}
            onApplySuggestion={() => {
                if (np.noteAiResult) np.onApplySuggestion(np.noteAiResult!)
              }}
            isSaving={np.isSaving}
            isAnalyzing={np.isAnalyzing}
            aiAvailable={np.aiAvailable}
            onClearDraft={np.onClearDraft}
          />

          {np.noteAiResult && (
            <NoteAiSuggestionPanel
              suggestion={np.noteAiResult}
              onApply={() => np.onApplySuggestion(np.noteAiResult!)}
              onDismiss={np.resetAnalyze}
            />
          )}
        </div>
      )}
```

替换为：

```tsx
      {activeTab === 'notes' && (
        <div className="space-y-3">
          {/* 速记 / 备忘录 二级 Tab：结构完全对称，仅 kind 不同 */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1">
            {NOTE_SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveNoteSection(section.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-bold transition-colors',
                  activeNoteSection === section.key
                    ? 'bg-card text-foreground shadow-[var(--shadow-xs)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {section.label}
              </button>
            ))}
          </div>

          <NoteComposer
            title={ns.title}
            content={ns.content}
            selectedTags={ns.selectedTags}
            onTagsChange={ns.onTagsChange}
            availableTags={ns.availableTags}
            onTitleChange={ns.onTitleChange}
            onContentChange={ns.onContentChange}
            onSave={ns.onSave}
            onAnalyze={ns.onAnalyze}
            aiSuggestion={ns.aiResult}
            onApplySuggestion={ns.onApplySuggestion}
            isSaving={ns.isSaving}
            isAnalyzing={ns.isAnalyzing}
            aiAvailable={ns.aiAvailable}
            onClearDraft={ns.onClearDraft}
          />

          {ns.aiResult && (
            <NoteAiSuggestionPanel
              suggestion={ns.aiResult}
              onApply={ns.onApplySuggestion}
              onDismiss={ns.resetAnalyze}
            />
          )}

          <NoteSummaryPanel
            titleQuery={ns.summaryTitleQuery}
            onTitleQueryChange={ns.onSummaryTitleQueryChange}
            availableTags={ns.availableTags}
            selectedTags={ns.summaryTags}
            onTagsChange={ns.onSummaryTagsChange}
            onSummarize={ns.onSummarize}
            isSummarizing={ns.isSummarizing}
            result={ns.summaryResult}
          />
        </div>
      )}
```

- [ ] **Step 3: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: 不应再有与 Inbox 笔记相关的类型错误（Task 17-18 涉及的文件除外）

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Inbox/InboxMobileView.tsx
git commit -m "refactor: InboxMobileView 新增速记/备忘录二级 Tab 与汇总面板"
```

---

## Task 17: 删除死代码 `QuickNotePanel.tsx`

**Files:**
- Delete: `frontend/src/pages/Inbox/components/QuickNotePanel.tsx`

`QuickNotePanel.tsx` 未被任何文件引用（已确认 `grep -rn "QuickNotePanel" frontend/src` 仅命中其自身定义），是早期 Phase 遗留的死代码。

- [ ] **Step 1: 删除文件**

```bash
rm frontend/src/pages/Inbox/components/QuickNotePanel.tsx
```

- [ ] **Step 2: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Inbox/components/QuickNotePanel.tsx
git commit -m "chore: 删除未使用的 QuickNotePanel 死代码"
```

---

## Task 18: 更新 Settings 中 Obsidian 目录展示

**Files:**
- Modify: `frontend/src/pages/Settings/components/InboxSettingsPanel.tsx`

`ObsidianSettingsCard` 展示的系统派生目录列表包含已废弃的 `Consolidated`（合并笔记目录），需改为新的标签索引目录 `tags`（对应 Task 2 中 `InboxSettingsService.getObsidianTagsDir()`）。

- [ ] **Step 1: 更新 `derivedDirs`**

将（约第 488-492 行）：

```typescript
  const derivedDirs = [
    `${inboxRoot}/Quick Note`,
    `${inboxRoot}/Memo`,
    `${inboxRoot}/Consolidated`,
  ]
```

替换为：

```typescript
  const derivedDirs = [
    `${inboxRoot}/Quick Note`,
    `${inboxRoot}/Memo`,
    `${inboxRoot}/tags`,
  ]
```

- [ ] **Step 2: TypeScript 类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings/components/InboxSettingsPanel.tsx
git commit -m "fix: Settings 笔记目录展示移除 Consolidated，改为 tags"
```

---

## Task 19: 全量构建验证

**Files:** 无新增文件，仅运行验证命令。

- [ ] **Step 1: 后端测试**

Run: `cd backend && mvn test`
Expected: BUILD SUCCESS，包括 `NoteTagIndexServiceTest`、`NoteAiServiceTest`、`ObsidianMarkdownWriterTest`、`NoteSummaryServiceTest`、`InboxControllerTest` 全部通过

- [ ] **Step 2: 前端类型检查**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 前端构建**

Run: `cd frontend && pnpm build`
Expected: 构建成功，无报错

- [ ] **Step 4: 手动验收（开发环境）**

启动后端（`cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local`）和前端（`cd frontend && pnpm dev`），在 Inbox → 笔记 Tab 验证：

1. 速记 / 备忘录二级 Tab 切换正常，各自草稿状态独立（在速记输入内容后切到备忘录，速记内容不丢失）。
2. 在速记中输入内容并点击"AI 整理"：返回的标签通过 `TagPicker` 展示，可勾选/取消，最多 3 个。
3. 保存笔记后，刷新标签索引（`GET /inbox/notes/tags?kind=quick_note`）应包含 AI 新建的标签及说明。
4. 笔记汇总区：输入标题关键词或选择标签后点击"生成汇总"，返回 Markdown 并可通过"复制"按钮写入剪贴板；未匹配时显示"未找到匹配笔记"。
5. 备忘录页面重复 2-4，确认标签索引文件独立（`memo-tags.md` vs `quick-note-tags.md`）。
6. Settings → Inbox 设置 → 笔记设置：确认系统目录展示为 `Quick Note` / `Memo` / `tags`，不再出现 `Consolidated`。

- [ ] **Step 5: Commit**

无代码改动，本任务仅验证，无需提交。若验证过程中发现问题，回到对应任务修复并提交。

---

## 自查（Self-Review）

**1. Spec 覆盖检查**（逐条核对 `docs/superpowers/specs/2026-06-14-inbox-notes-refactor-design.md`）：

- 第 1 节（导航与页面结构、`useNoteSection`）：Task 13-16 覆盖。
- 第 2 节（标签索引文件存储/格式/`NoteTagIndexService`）：Task 1-2 覆盖。
- 第 3 节（AI 标签流程、`NoteAnalyzeResponse.newTagDescriptions`）：Task 3-4 覆盖。
- 第 4 节（`TagPicker`、`NoteComposer` 改造）：Task 10、12 覆盖。
- 第 5 节（`/notes/tags` 接口、`QuickNoteRequest.newTagDescriptions`、`ObsidianMarkdownWriter.write()` 写回标签）：Task 3、5、7、9 覆盖。
- 第 6 节（`/notes/summarize` 接口、`NoteSummaryPanel`）：Task 6、7、11 覆盖。
- 第 7 节（清理项：`QuickNotePanel`、consolidate 接口/DTO/类型、Settings 目录展示）：Task 6（后端 DTO 删除）、8-9（前端类型/接口）、17-18 覆盖。
- 第 8 节（测试）：Task 1、4、5、6、7 包含对应单元测试；Task 19 包含构建验证与手动验收。
- 第 9 节（风险与边界情况）：`NoteTagIndexService` 容错解析（Task 1）、AI 不可用降级（Task 4）、汇总扫描数量不分页（按设计文档明确为已知限制，不在本次范围内处理）。

无未覆盖的 spec 条目。

**2. Placeholder 扫描**：全文搜索 "TBD"/"TODO"/"待实现"/"参考 Task N 类似代码" 等模式，未发现遗留占位符；所有代码块均为完整实现。

**3. 类型一致性检查**：

- `NoteTagEntryResponse{name, description}` ↔ 前端 `NoteTagEntry{name, description}` 一致（Task 1、8）。
- `NoteAnalyzeResponse.newTagDescriptions: Map<String,String>` ↔ 前端 `newTagDescriptions?: Record<string, string>` 一致（Task 3、8）。
- `QuickNoteRequest.newTagDescriptions` 在 Task 3（后端）、Task 8（前端类型）、Task 13（`useNoteSection.onSave` 提交）中字段名一致。
- `NoteSummarizeRequest{kind, titleQuery, tags}` / `NoteSummarizeResponse{markdown, matchedCount}` 在 Task 6（后端 DTO）、Task 8（前端类型）、Task 9（`inboxApi.notes.summarize`）、Task 11（`NoteSummaryPanel`）、Task 13（`useNoteSection`）中字段名与可选性一致。
- `inboxApi.notes.tags(kind)` / `inboxApi.notes.summarize(data)` 在 Task 9 定义，Task 13 `useNoteSection` 中调用方式一致。
- `TagPicker` 的 `availableTags`/`selectedTags`/`onChange`/`maxTags` 在 Task 10 定义，Task 11（不传 `maxTags`）、Task 12（`maxTags={3}`）中使用一致。
- `NoteComposerProps`（Task 12：`title/content/selectedTags/onTagsChange/availableTags/onTitleChange/onContentChange/onSave/onAnalyze/aiSuggestion/onApplySuggestion/isSaving/isAnalyzing/aiAvailable/onClearDraft`）与 `useNoteSection` 返回值（Task 13）及 `InboxDesktopView`/`InboxMobileView` 中的调用（Task 15-16）字段名逐一对应。
- `NoteSummaryPanelProps`（Task 11）与 `useNoteSection` 中 `summaryTitleQuery/onSummaryTitleQueryChange/summaryTags/onSummaryTagsChange/onSummarize/isSummarizing/summaryResult`（Task 13）及 Task 15-16 中的调用一致。
- `NoteSectionProps = NoteSectionState`（Task 15）在 `InboxDesktopViewProps`/`InboxMobileViewProps` 中作为 `quickNoteProps`/`memoProps` 类型，与 `index.tsx` 中 `quickNoteSection`/`memoSection`（Task 14）类型匹配。

无发现类型不一致问题。

---
