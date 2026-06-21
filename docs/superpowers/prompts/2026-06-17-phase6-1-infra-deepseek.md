# Phase 6.1 — 基础设施层（后端）提示词

执行计划：`docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md`（Phase 6.1 节）  
设计文档：`docs/superpowers/specs/2026-06-17-mindbank-crawl-phase6-design.md`

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），这是一个 Spring Boot 3.x + MyBatis-Plus 3.5.7 + React 18 的个人 AI 工作台。请先阅读 `CLAUDE.md` 了解项目规范，再阅读 `docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md` 的 Phase 6.1 节了解本阶段任务。

本阶段目标：搭建 Phase 6 全部依赖的后端基础设施，不涉及任何前端代码。

> **前置：先在 192.168.110.10 部署 MarkItDown 服务**（见下方"Step 0"），再开始 Java 后端开发。

---

## Step 0：部署 MarkItDown 服务（在 192.168.110.10 上执行）

MarkItDown 是 Microsoft 开源的文件格式转换工具，Nexus 用它把 PDF / DOCX / XLSX / PPTX 等文件统一转为 Markdown。项目已在 `services/markitdown/` 目录下准备好所有文件（`main.py`、`Dockerfile`、`docker-compose.yml`、`requirements.txt`）。

**部署步骤：**

```bash
# 1. 把 services/markitdown/ 目录推送到 192.168.110.10
#    （scp、rsync 或 git pull 均可，取决于你的工作流）
scp -r services/markitdown/ user@192.168.110.10:~/nexus-markitdown/

# 2. SSH 登录到 192.168.110.10
ssh user@192.168.110.10

# 3. 进入目录，启动服务
cd ~/nexus-markitdown
docker compose up -d

# 4. 验证服务启动成功
curl http://localhost:3004/health
# 返回 {"status":"ok"} 即成功

# 5. 测试文件转换（用一个 PDF 测试）
curl -X POST http://localhost:3004/convert \
  -F "file=@/path/to/test.pdf" | python3 -m json.tool
# 应返回 { "markdown": "...", "title": "...", "length": N }
```

**拉取镜像失败（国内网络限速）：** Dockerfile 已使用阿里云镜像源（`registry.cn-hangzhou.aliyuncs.com/library/python:3.11-slim`），正常无需额外配置。若仍失败，在 192.168.110.10 上执行：

```bash
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
EOF
sudo systemctl daemon-reload && sudo systemctl restart docker
# 然后重新 docker compose up -d
```

**服务信息：**
- 对外端口：`3004`
- 接口：`POST /convert`（multipart 上传文件，返回 `{ markdown, title, length }`）
- Nexus 后端调用地址：`http://192.168.110.10:3004/convert`

MarkItDown 服务就绪后，继续以下 Java 后端步骤。

---

请按以下顺序执行：

1. **添加 Maven 依赖**：在 `backend/pom.xml` 中添加 `io.minio:minio:8.5.7` 和 `com.squareup.okhttp3:okhttp:4.12.0`。运行 `mise exec java@21 -- mvn -q -pl backend dependency:resolve` 确认依赖可解析。

2. **Flyway 迁移**：创建 `backend/src/main/resources/db/migration/V1_16__mindbank_init.sql`，内容见计划文档 Phase 6.1 节（含三张表 + 内置 Prompt 模板初始数据）。命名格式遵循项目 `CLAUDE.md` 规范（双下划线分隔）。

3. **KnowledgeBasePort 接口**：在 `backend/src/main/java/com/nexus/port/` 下创建 `KnowledgeBasePort.java`（接口）和 `KnowledgeBaseAnswer.java`（record），内容见计划文档。

4. **Entity + Mapper**：在 `entity/` 下创建 `MindBankWorkspace.java`、`MindBankDocument.java`、`MindBankPromptTemplate.java`（参照现有 Entity 如 `ChatConversation.java` 的写法：`@Data @TableName @Builder`）。在 `mapper/` 下创建对应三个 Mapper 接口（继承 `BaseMapper<T>`）。注意：boolean 字段命名避免 `isXxx` 前缀（参考 CLAUDE.md 中 MyBatis-Plus boolean 字段约束）。

5. **MinioService**：在 `integration/minio/` 下创建 `MinioService.java` 和 `MinioFileInfo.java`（record）。`MinioService` 使用 `io.minio.MinioClient`，服务地址 `http://192.168.110.105:7001`，AccessKey/SecretKey 从 `SystemConfigService.get("mindbank.minio.access_key"/"mindbank.minio.secret_key")` 读取后用 `LlmConfigService.decrypt()` 解密。需要实现：`uploadText(bucket, key, content)`、`uploadStream(bucket, key, stream, size, contentType)`、`downloadAsString(bucket, key)`、`deleteFile(bucket, key)`、`listFiles(bucket, prefix)`。

6. **AnythingLlmClient**：在 `integration/anythingllm/` 下创建，实现 `KnowledgeBasePort`，使用 Spring `RestClient`（或 `WebClient`，参照项目现有写法）。API 基础地址 `http://192.168.110.10:3001`，Bearer Token 从 `SystemConfigService.get("mindbank.anythingllm.api_key")` 读取后解密。实现 4 个方法：`createWorkspace`（POST /api/v1/workspaces）、`uploadDocument`（POST /api/v1/workspace/{slug}/upload-text）、`deleteDocument`（DELETE /api/v1/workspace/{slug}/remove-embedded/{docId}）、`query`（POST /api/v1/workspace/{slug}/chat）。

7. **Crawl4AiClient**：在 `integration/crawl4ai/` 下创建。实现 `submitCrawl(url)` → 返回 taskId，`getResult(taskId)` → 返回 `Crawl4AiResult`（含 status、markdownContent、rawHtml）。基础地址 `http://192.168.110.10:3003`，参照 Crawl4AI API 文档（POST /crawl，GET /task/{id}）。

8. **MarkItDownClient**：在 `integration/markitdown/` 下创建。实现 `convert(MultipartFile file)` → 返回 String（markdown 内容）。调用 POST `http://192.168.110.10:3004/convert`，multipart 上传。

9. **编译验证**：
```bash
mise exec java@21 -- mvn -q -pl backend compile
```

10. **启动验证**：
```bash
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
# 观察日志：V1_16 migration applied，无启动报错
# 启动成功后 Ctrl+C 停止
```

**注意事项：**
- 所有 Service/Client 类加 `@Service` 注解，构造器注入（不用 `@Autowired` 字段注入）
- 中文注释说明类职责（CLAUDE.md 要求）
- SystemConfigService 若无对应 key 返回 null，Client 初始化时做 null 检查并记录 warn 日志（不要抛启动失败）
- 不要实现任何 Controller，本阶段只做基础层
