# Crawl4AI API 适配升级方案

> 当前代码基于 Crawl4AI 旧版异步任务 API（`POST /crawl` 返回 `task_id`，轮询 `/task/{id}`），
> 但新版 Crawl4AI（Docker `unclecode/crawl4ai:latest`）已改为**同步 API**，一次请求直接返回结果。

---

## 一、新旧 API 对比

### 旧版（代码现状）

```
POST /crawl
Body: {"url": "https://example.com"}
Response: {"task_id": "abc123"}

GET /task/abc123
Response: {"status": "completed", "result": {"markdown": "...", "html": "..."}}
```

### 新版（当前 Crawl4AI Docker）

```
POST /crawl
Body: {
  "urls": ["https://example.com"],
  "browser_config": {},
  "crawler_config": {}
}
Response: {
  "success": true,
  "results": [
    {
      "url": "https://example.com",
      "success": true,
      "html": "<html>...</html>",
      "markdown": {
        "raw_markdown": "# Page Title\n...",
        "markdown_with_citations": "...",
        "references_markdown": "...",
        "fit_markdown": "..."
      },
      "error_message": null,
      "status_code": 200,
      "metadata": {...}
    }
  ]
}
```

### 核心差异

| 维度 | 旧版 | 新版 |
|------|------|------|
| 请求字段 | `url`（单个字符串） | `urls`（字符串数组，必填） |
| 额外字段 | 无 | `browser_config`（可选）、`crawler_config`（可选） |
| 响应模式 | 异步：先返回 `task_id`，轮询获取结果 | **同步**：直接返回 `results` 数组 |
| Markdown 格式 | `result.markdown`（字符串） | `result.markdown.raw_markdown`（嵌套对象） |
| HTML 格式 | `result.html`（字符串） | `result.html`（字符串，不变） |
| 任务轮询端点 | `GET /task/{taskId}` | **已移除**，不再存在 |
| 错误判断 | `status == "failed"` | `success == false` + `error_message` |
| 默认端口 | 3003（代码硬编码） | **11235**（Docker 标准端口） |

---

## 二、涉及文件与改动

### 2.1 `Crawl4AiClient.java` — **重写**

**当前代码**（需删除的逻辑）：
- `submitCrawl(url)` → 发送 `{"url": url}`，解析返回的 `task_id`
- `getResult(taskId)` → 轮询 `GET /task/{taskId}`，解析 `status` / `result`

**新代码**：

```java
/**
 * 同步爬取 URL，直接返回结果。
 * 新版 Crawl4AI 已无异步任务概念，POST /crawl 阻塞返回 results 数组。
 */
public Crawl4AiResult crawl(String url) {
    Map<String, Object> body = Map.of(
        "urls", List.of(url),
        "browser_config", Map.of(),
        "crawler_config", Map.of()
    );

    Map<?, ?> resp = client().post()
            .uri("/crawl")
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
            .retrieve()
            .body(Map.class);

    Boolean success = (Boolean) resp.get("success");
    if (!Boolean.TRUE.equals(success)) {
        throw new RuntimeException("Crawl4AI 爬取失败");
    }

    List<?> results = (List<?>) resp.get("results");
    if (results == null || results.isEmpty()) {
        throw new RuntimeException("Crawl4AI 返回空结果");
    }

    Map<?, ?> first = (Map<?, ?>) results.get(0);
    Boolean resultSuccess = (Boolean) first.get("success");
    if (!Boolean.TRUE.equals(resultSuccess)) {
        String errorMsg = first.get("error_message") != null
            ? String.valueOf(first.get("error_message")) : "未知错误";
        throw new RuntimeException("Crawl4AI 爬取失败: " + errorMsg);
    }

    // Markdown 现在是嵌套对象：{raw_markdown, fit_markdown, ...}
    String markdown = null;
    Object markdownObj = first.get("markdown");
    if (markdownObj instanceof Map<?, ?> mdMap) {
        // 优先使用 fit_markdown（过滤后的精简版），其次 raw_markdown
        markdown = mdMap.get("fit_markdown") != null
            ? String.valueOf(mdMap.get("fit_markdown"))
            : String.valueOf(mdMap.get("raw_markdown"));
    } else if (markdownObj != null) {
        markdown = String.valueOf(markdownObj);
    }

    String html = first.get("html") != null ? String.valueOf(first.get("html")) : null;

    return new Crawl4AiResult("completed", markdown, html, null);
}
```

**删除的方法**：
- `submitCrawl(String url)` — 替换为 `crawl(String url)`
- `getResult(String taskId)` — 完全删除

**DEFAULT_BASE_URL 更新**：
```java
// 旧
private static final String DEFAULT_BASE_URL = "http://192.168.110.10:3003";
// 新（与 docker-compose 一致）
private static final String DEFAULT_BASE_URL = "http://192.168.110.10:11235";
```

**超时配置**：新版 API 是同步阻塞的，爬取可能耗时较长，需要增大 RestClient 超时：
```java
private RestClient client() {
    return RestClient.builder()
            .baseUrl(systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL))
            .defaultHeader("Accept", "application/json")
            .requestFactory(new SimpleClientHttpRequestFactory() {{
                setConnectTimeout(Duration.ofSeconds(10));
                setReadTimeout(Duration.ofSeconds(120)); // 爬取可能耗时较长
            }})
            .build();
}
```

### 2.2 `Crawl4AiResult.java` — 无变更

```java
public record Crawl4AiResult(String status, String markdownContent, String rawHtml, String errorMsg) {
    public boolean isCompleted() { return "completed".equals(status); }
    public boolean isFailed() { return "failed".equals(status); }
}
```

Record 结构不变，`crawl()` 方法直接构造返回。

### 2.3 `CrawlService.java` — 简化

**当前代码**（需删除的逻辑）：
- `crawlWeb()` 中：调用 `submitCrawl()` 获取 `taskId` → `pollUntilDone(taskId)` 轮询
- `pollUntilDone()` 方法：`while` 循环 + `Thread.sleep(3000)` + `getResult(taskId)`

**新代码**：

```java
public CrawlResultResponse crawlWeb(String url) {
    // 1. 同步爬取（新版 API 直接返回结果，无需轮询）
    Crawl4AiResult result = crawl4AiClient.crawl(url);
    if (result.isFailed() || result.markdownContent() == null) {
        throw new RuntimeException("网页爬取失败: "
            + (result.errorMsg() != null ? result.errorMsg() : "未返回内容"));
    }

    // 2. 上传到 MinIO（不变）
    // 3. 入库（不变）
    // 4. 返回结果（不变）
    // ... 后续逻辑完全不变 ...
}
```

**删除的方法**：
- `pollUntilDone(String taskId)` — 完全删除
- 相关常量 `POLL_MAX_SECONDS` / `POLL_INTERVAL_MS` — 删除

---

## 三、完整变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `Crawl4AiClient.java` | **重写** | `submitCrawl` + `getResult` → 单个 `crawl` 方法；更新默认端口 |
| `CrawlService.java` | **简化** | 删除 `pollUntilDone`；`crawlWeb` 改调 `crawl4AiClient.crawl()` |
| `Crawl4AiResult.java` | 无变更 | Record 结构兼容 |
| `CrawlController.java` | 无变更 | 接口签名不变 |
| 前端 | 无变更 | 前端调用 `/api/v1/crawl/web` 不变 |

---

## 四、注意事项

### 4.1 超时

新版 API 是同步阻塞调用，服务端完成爬取后才返回。复杂页面可能需要 30-60 秒。RestClient 的 `readTimeout` 需设为 120 秒以上，否则会因超时报错。

### 4.2 `fit_markdown` vs `raw_markdown`

- `raw_markdown`：原始 Markdown，包含页面全部内容
- `fit_markdown`：Crawl4AI 智能过滤后的精简版（去除导航、广告等）
- 建议优先使用 `fit_markdown`，为空时降级到 `raw_markdown`

### 4.3 认证（可选）

新版 Crawl4AI Docker 支持 API Token 认证（`CRAWL4AI_API_TOKEN` 环境变量）。如果服务端配置了 Token，客户端需要在请求头中添加 `Authorization: Bearer <token>`。当前代码无认证，如果服务端未配置 Token 则无需处理。

### 4.4 端口配置

代码中 `DEFAULT_BASE_URL` 硬编码了 `3003`，但 docker-compose 和 .env 示例中使用 `11235`。应更新默认值，并确保 `SystemConfigService` 中的配置键 `crawl.crawl4ai.url` 正确指向实际服务地址。

### 4.5 批量爬取

新版 API 支持在 `urls` 中传入多个 URL 批量爬取。当前只需单 URL，但未来可以扩展。
