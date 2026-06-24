# Crawl4AI API 适配升级 — 执行提示词

> 将此提示词交给 Claude Code 执行，它会按照方案文档 `docs/crawl4ai-upgrade-plan.md` 完成适配。

---

## 提示词

```
请按照 docs/crawl4ai-upgrade-plan.md 中的方案，将 Crawl4AI 客户端从旧版异步任务 API 适配到新版同步 API。

## 背景

当前代码使用旧版 Crawl4AI API（POST /crawl 返回 task_id，轮询 GET /task/{id} 获取结果），
但新版 Crawl4AI Docker 已改为同步 API（POST /crawl 直接返回 results 数组，无 task_id，无轮询）。

新版 API 要求：
- 请求体：`{"urls": ["https://..."], "browser_config": {}, "crawler_config": {}}`
- 响应体：`{"success": true, "results": [{"url": "...", "success": true, "html": "...", "markdown": {"raw_markdown": "...", "fit_markdown": "..."}, ...}]}`
- 默认端口从 3003 改为 11235

## 执行步骤

### 1. 重写 `Crawl4AiClient.java`

文件：`backend/src/main/java/com/nexus/integration/crawl4ai/Crawl4AiClient.java`

- 删除 `submitCrawl(String url)` 方法
- 删除 `getResult(String taskId)` 方法
- 新增 `crawl(String url)` 方法：
  - 构造请求体：`{"urls": [url], "browser_config": {}, "crawler_config": {}}`
  - POST 到 `/crawl`，直接解析响应
  - 检查 `resp.success == true`
  - 从 `resp.results[0]` 取出第一个结果
  - 检查 `result.success == true`，否则取 `error_message` 报错
  - Markdown 取法：`result.markdown` 是嵌套对象，优先用 `fit_markdown`，为空则用 `raw_markdown`
  - HTML 取法：`result.html`（字符串，不变）
  - 返回 `new Crawl4AiResult("completed", markdown, html, null)`
- 更新 `DEFAULT_BASE_URL` 为 `http://192.168.110.10:11235`
- `client()` 方法增加超时配置：connectTimeout 10秒，readTimeout 120秒（同步 API 爬取耗时较长）
- 更新类 Javadoc 说明新版 API 是同步调用

### 2. 简化 `CrawlService.java`

文件：`backend/src/main/java/com/nexus/service/CrawlService.java`

- `crawlWeb()` 方法：
  - 删除 `String taskId = crawl4AiClient.submitCrawl(url)` 和相关日志
  - 删除 `Crawl4AiResult result = pollUntilDone(taskId)` 
  - 替换为：`Crawl4AiResult result = crawl4AiClient.crawl(url)`
  - 添加日志：`log.info("Crawl4AI 同步爬取完成: url={}", url)`
  - 后续的 MinIO 上传、入库、返回逻辑完全不变
- 删除 `pollUntilDone(String taskId)` 整个方法
- 删除常量 `POLL_MAX_SECONDS` 和 `POLL_INTERVAL_MS`

### 3. 保持不变的文件

- `Crawl4AiResult.java` — record 结构不变
- `CrawlController.java` — 接口签名不变
- 前端代码 — 不涉及

## 注意事项

- 保持项目的注释规范：类和公共方法加 Javadoc，注释说明 WHY 不是 WHAT，中文优先
- RestClient 超时必须设足够长（120 秒），因为新版 API 是同步阻塞的
- Markdown 优先使用 fit_markdown（智能过滤版），为空时降级到 raw_markdown
- 改完后用 `mvn compile` 验证编译通过
```
