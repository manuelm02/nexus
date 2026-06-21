# Nexus Mindbank：Pipeline + Agent 双层架构设计文档

> 版本：2026-06-18 v1
> 状态：架构定稿（开发前纲领文档）
> 范围：Mindbank 知识处理中心的「确定性入库 Pipeline + Agent 知识运维层」整体设计
> 前置文档：《Nexus Phase 6：Mindbank & Crawl 系统设计文档》(2026-06-17 v2)

---

## 0. 这份文档要解决什么

前一版 Phase 6 文档已经把 Mindbank 的入库流水线（Crawl 摄入 → MinIO 存储 → 5 步 AI Pipeline → Obsidian + AnythingLLM）设计清楚了。但在评审中暴露了一个**根本问题**：

> 那套设计能保证「**单篇材料入库时整理得好**」，但无法保证「**知识库长期累积后依然体系化、不混乱**」。

混乱的真正来源不在入库环节，而在**长期维护的缺失**：

- 没有机制在 Master Note 膨胀到几千行时提醒拆分
- Workspace 全靠手动创建，没人发现两个 Workspace 已经该合并 / 该重新切分
- 「知识地图」索引靠每次融合 Prompt 维护，时间一长必然与正文漂移
- 笔记之间的孤立、重叠、矛盾，没有任何主动巡检

**本文档的核心结论：** Mindbank 应设计为**双层结构**——

1. **入库 Pipeline 层（确定性）**：高频、稳定、无人值守地把材料变成知识。基本沿用 Phase 6 v2 设计。
2. **Agent 知识运维层（非确定性）**：低频、需判断、有人审批地维护整个知识库的体系性。这是新增的核心，也是「让知识体系化、不混乱」的真正答案。

并且明确了两个关键技术决策：

- **Agent 用 LangChain4j 自建**，不引入外部 Agent 框架（含已评估并放弃的 AgentScope-Java、Pi）。
- **Agent 全程集成在 Nexus 内部**，作为 Mindbank 页面的一个子 Tab，符合 Nexus「all-in-one」定位，不切换工具。

---

## 1. 为什么是「Pipeline + Agent」双层，而不是全 Agent 化

这是整份设计的思想基石，务必理解透。

### 1.1 Pipeline 与 Agent 的本质区别

| 维度 | Pipeline（流水线） | Agent（智能体） |
|------|-------------------|----------------|
| 控制流 | 你预先写死：Step1→2→3→4→5 | 模型自己决定下一步做什么、做几步、何时停 |
| 确定性 | 高，同样输入基本同样行为 | 低，每次可能走不同路径 |
| 可调试性 | 强，哪步错了一目了然 | 弱，要看完整执行轨迹才知道它为什么这么做 |
| Token 成本 | 可控，步数固定 | 不可控，可能多轮往返 |
| 适合的活 | 高频、重复、流程清晰的任务 | 低频、需判断、流程因情况而异的任务 |

### 1.2 各自的归属

- **入库**是高频任务（可能每天几十次），需要稳定、最好无人值守。→ 用 **Pipeline**。把 Agent 的非确定性和高 token 成本花在这种高频路径上是浪费且危险的。
- **知识库巡检 / 结构重整**是低频任务（每周一次甚至更少），且每次面对的问题都不一样（这次是某笔记太长，下次是两个 Workspace 重叠），无法预先写死流程。→ 用 **Agent**。它需要的恰恰是「自己判断该看哪些、哪里有问题、怎么改」这种非确定性能力。

### 1.3 一句话总结

> **确定的事走 Pipeline，需要判断的事走 Agent。** 这个边界一旦划清，整个系统的复杂度、成本、可维护性都会非常健康。过早全 Agent 化只会让调试变难、成本飙升、且讲不清楚架构。

---

## 2. 为什么 Agent 用 LangChain4j 自建（决策记录）

这一节记录我们排除其他方案的完整推理，避免日后反复纠结。

### 2.1 Agent loop 的本质：它不是黑魔法

很多人误以为「做 Agent」必须依赖某个专门框架。其实一个 Agent loop 的核心就三样东西：

1. **工具（Tools）**：Agent 的手脚。把方法暴露给模型调用（读笔记、查 AnythingLLM、写 Obsidian）。
2. **循环（Loop）**：Agent 的大脑。把任务 + 可用工具给模型 → 模型决定下一步（调工具 or 给结论）→ 执行 → 结果塞回上下文 → 再问模型 → 直到「完成」或达步数上限。
3. **状态（State / Memory）**：Agent 多步执行时的上下文与进度。

LangChain4j 已经把**最难的「工具调用」这块做好了**（`@Tool` 注解 + AI Services 自动编排），剩下的循环和状态组织对你的领域专一场景来说，代码量很小。

### 2.2 为什么不接外部框架（逐个排除）

**排除 Pi（earendil-works/pi）：**
- Pi 是 CLI / 终端交互形态的「编码 + 运维 agent harness」，核心是 Read/Write/Edit/Bash 四工具 + 运行时自扩展。
- 它为「人在终端里和 agent 对话」设计，要嵌进 Web 后端得套一层进程通信（remote-pi 走 Unix socket + relay），状态难追踪，且和 Java 后端是两个运行时。
- **结论**：Pi 不适合当 Mindbank 后端底座。但它非常适合当**你这个开发者手里的知识库运维 agent**——在终端里手动跑巡检、批量修复 vault。这是它的正确位置，与 Nexus 内置 Agent 不冲突，可作为补充工具按需使用。

**排除 AgentScope-Java（alibaba / agentscope-ai）：**
- 它是成熟的大厂框架，技术栈兼容（Spring Boot + JDK17+），且内置了 ReAct loop、中断/恢复、PlanNotebook、长期记忆、JSONL trace 导出等——等于把我们想自建的基础设施打包好了。客观上是个好东西。
- 但对**我们的具体场景**有三个硬伤：
  1. **响应式编程门槛**：它全程 Project Reactor（Mono/Flux），官方明确禁止在示例里用 `.block()`。我们的 Nexus 是标准命令式 Spring Boot（MyBatis-Plus 同步代码）。把响应式框架塞进命令式代码库，要么到处 `.block()` 丢掉优雅与性能，要么大面积改造成响应式，学习曲线陡。这是最大的摩擦点。
  2. **与 LangChain4j 功能重叠**：它的 ReActAgent + Toolkit + Memory 和 LangChain4j 的 AI Services + Tools + ChatMemory 是同一层。一个项目塞两个 agent 框架是技术债。
  3. **过重**：它在往「生产级 agent 平台」（Studio、OTel、多 agent A2A、RocketMQ、K8s）发展。我们只是个人知识库的几个内部巡检任务，用不到这些重型能力，却要承担其复杂度与体积。
- **结论**：对当下目标属于「杀鸡用牛刀」，且这把牛刀和我们手里的刀（LangChain4j + 命令式 Spring Boot）合不来。**放弃。**

### 2.3 自建的额外好处（对求职）

能讲清楚「agent loop = 循环 + 工具调用 + 状态」的原理，比「我调了某框架的 `run()` 方法」更能打动 AI Agent 岗位的面试官。自建让你对每个环节有完整掌控感和解释能力。

### 2.4 保留的「升级口子」

若未来 Nexus 的 Agent 需求真的膨胀（多 agent 协作、沙箱执行不可信工具代码），或你想把「学一个大厂生产级框架」作为简历素材，可以**单独起分支用 AgentScope-Java 重写 Agent 层做对比**。那时你已有清晰需求 + 一个能跑的 LangChain4j 基线，评估更有的放矢，本身也是优质简历素材（「用两种方案实现同一 agent 层并做权衡」）。但这是**可选的未来**，不是当下路径。

---

## 3. 整体架构总览

Mindbank 重新切成**四层**（含一个地基层 Layer 0）。

```
┌──────────────────────────────────────────────────────────────┐
│  Mindbank 页面（子 Tab 划分，集成在 Nexus 内，all-in-one）      │
│  ┌──────────┬──────────┬─────────────────┐                   │
│  │ 文件/入库 │  Q&A     │ 🆕 Agent 知识管家 │                   │
│  └──────────┴──────────┴─────────────────┘                   │
│  （笔记浏览复用 Nexus 已有的全局 Obsidian 浏览页，不在此重复）   │
└──────────────────────────────────────────────────────────────┘
         │              │                   │
┌────────▼──────────────▼───────────────────▼─────────────────┐
│  Nexus Backend (Spring Boot 3 + Java 21 + LangChain4j)        │
│                                                              │
│  ┌────────────────────┐   ┌───────────────────────────────┐ │
│  │  Layer 1            │   │  Layer 2                       │ │
│  │  入库 Pipeline       │   │  Agent 知识运维层               │ │
│  │  （确定性/无人值守）  │   │  （非确定性/有人审批）           │ │
│  │                    │   │                               │ │
│  │  Step1 类型识别      │   │  Agent A：融合自检（入库时调用）  │ │
│  │  Step2 融合整理 ─────┼───┼─→（可选）调用 Agent A          │ │
│  │  Step3 速记         │   │  Agent B：知识库巡检（定时/手动） │ │
│  │  Step4 写 Obsidian  │   │  Agent C：Q&A 检索（问答时）     │ │
│  │  Step5 embedding    │   │                               │ │
│  └─────────┬──────────┘   └──────────────┬────────────────┘ │
│            │                             │                  │
│  ┌─────────▼─────────────────────────────▼────────────────┐ │
│  │  Layer 0  共享能力层（Port 接口，可替换实现）             │ │
│  │  KnowledgeBasePort / NotePort / StoragePort /            │ │
│  │  LlmPort / CrawlPort                                     │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
            │              │            │            │
      AnythingLLM      Obsidian       MinIO     Crawl4AI/
       (3001)          vault        (7001)     MarkItDown
```

**理解这张图的关键**：

- **Layer 0 是地基**：把所有外部能力抽象成 Port 接口。Pipeline 和 Agent **共用同一组 Port**。
- **Agent 的「工具」其实就是 Port 方法的包装**。Agent 能做的事 = Port 能力的子集 + 组合。这就是为什么先抽 Port 这么重要——它让 Pipeline 和 Agent 不重复造轮子。
- **Pipeline 与 Agent 之间唯一的交汇点**：Pipeline 的 Step 2 可以选择调用 Agent A（融合自检）。其余各自独立。
- **笔记浏览不在 Mindbank 内重复**：Nexus 已有一个全局的 Obsidian 笔记浏览页，浏览笔记的需求交给它即可。注意——这只是「给人看」的前端页面，与 Agent 读笔记的能力**完全无关**：Agent 读笔记走的是 Layer 0 的 `NotePort`（后端直接读 vault 文件），不经过任何前端页面。详见 7.3。

---

## 4. Layer 0：共享能力层（地基）

> 这是整个重构的地基。Phase 6 v2 文档第 11 节已有 `KnowledgeBasePort` 雏形，这里把它扩展成一组 Port。

### 4.1 设计原则

- 每个外部依赖（AnythingLLM、Obsidian、MinIO、LLM、Crawl）抽象成一个 Port 接口。
- Port 只定义「能做什么」，不关心「谁来用」。Pipeline 用它、Agent 用它、未来迁移自实现 RAG 也只换 Port 实现。
- 参考项目现有 `TranslationProviderPort` 的端口适配器模式（Hexagonal / Ports & Adapters）。

### 4.2 Port 清单

```java
// 知识库操作（AnythingLLM，未来可换 PGVector + LangChain4j）
public interface KnowledgeBasePort {
    String createWorkspace(String name, String description);
    void uploadDocument(String workspaceSlug, String content, String filename);
    void deleteDocument(String workspaceSlug, String docId);
    KnowledgeBaseAnswer query(String workspaceSlug, String question);
    KnowledgeBaseAnswer queryMultiple(List<String> workspaceSlugs, String question);
}

// Obsidian vault 笔记读写
public interface NotePort {
    String readMaster(String workspaceName);              // 读 Master Note 全文
    void writeMaster(String workspaceName, String content); // 覆盖写 Master Note
    void appendSession(String workspaceName, String content); // 追加 Session Note
    List<NoteMeta> listNotes();                           // 列出 vault 所有笔记（含路径、大小、更新时间）
    String readIndex();                                   // 读 _index.md 全局索引
    void writeIndex(String content);                      // 更新全局索引
}

// MinIO 文件存储
public interface StoragePort {
    List<FileMeta> listFiles(String prefix);              // 列文件（originals/ 或 processed/）
    byte[] getOriginal(String path);                      // 取原始文件
    String getProcessed(String path);                     // 取转换后 Markdown
    void putOriginal(String path, byte[] data);
    void putProcessed(String path, String markdown);
}

// 统一 LLM 调用（复用现有 LlmConfigService）
public interface LlmPort {
    String complete(String model, String prompt);
    // 供 Agent 用的带工具调用版本由 LangChain4j AI Service 封装，见 Layer 2
}

// 内容摄入（Crawl4AI + MarkItDown）
public interface CrawlPort {
    String crawlUrl(String url);                          // 网页 → Markdown
    String convertFile(byte[] file, String extension);    // 文件 → Markdown
}
```

### 4.3 为什么这是关键的第一步

- **避免重复逻辑**：Agent 要「读 Master Note」时，不用自己写读文件逻辑，直接用 `NotePort.readMaster`。Pipeline 写 Master Note 也是同一个 `NotePort.writeMaster`。
- **可测试**：Port 可以 mock，Pipeline 和 Agent 都能脱离真实 AnythingLLM / MinIO 做单测。
- **可迁移**：未来从 AnythingLLM 迁到自实现 RAG，只换 `KnowledgeBasePort` 的实现 Bean，上层 Pipeline 和 Agent 一行不改。

---

## 5. Layer 1：入库 Pipeline（确定性，沿用 Phase 6 v2）

> 这一层基本就是 Phase 6 v2 文档第 6 节的 5 步流水线，**几乎不动**。这里只说明它在新架构下的定位与唯一改动。

### 5.1 五步回顾

```
MinIO processed/ 的 Markdown 文件
    ↓
Step 1：内容类型识别（最快模型，判断 A~F 类型，决定 Step2 用哪套 Prompt）
    ↓
Step 2：AI 融合整理 → 更新 Master Note（最强模型）
        ← 唯一改动点：此步可选调用 Agent A 做融合自检
    ↓
Step 3：AI 生成 Session Note（中等模型，本次导入速记）
    ↓
Step 4：写入 Obsidian vault（Master 覆盖 + Session 追加 + 更新 _index.md）
    ↓
Step 5：更新 AnythingLLM embedding（删旧 doc + 上传新 Master Note）
```

每步独立状态 `pending → processing → done / failed`，失败可单步重试。（细节见 Phase 6 v2 文档，此处不重复。）

### 5.2 唯一改动：Step 2 升级为「可选融合自检」

**原设计**：Step 2 是一次性 Prompt 调用——把「已有笔记 + 新材料」丢给模型，让它一次输出完整新版 Master Note。

**问题**：文档越长，单次调用越容易漏知识点、章节重组乱、矛盾判断错。

**新设计**：当 Master Note 已存在**且**新材料较复杂时，Step 2 不直接调 Prompt，而是**调用 Agent A（融合自检 Agent，见 6.2）**，让它多轮自检后再产出。简单材料 / 首次导入仍走原来的单次 Prompt，避免浪费。

判断「是否走 Agent A」的简单策略（可配置）：
- Master Note 不存在（首次导入）→ 走原始单次生成 Prompt
- 新材料 token 数 < 阈值（如 1500）→ 走原始单次融合 Prompt
- 否则 → 走 Agent A 融合自检

### 5.3 为什么 Pipeline 必须保持确定性

入库是高频路径。如果整条 Pipeline 都 Agent 化：
- 每次入库 token 成本不可控（多轮往返）
- 调试困难（每次走的路径可能不同）
- 无人值守批量导入时风险大

所以**只在 Step 2 这一个「质量命门」上按需引入 Agent**，其余四步保持死板的确定性。

---

## 6. Layer 2：Agent 知识运维层（核心新增）

三个 Agent，全部用 LangChain4j 自建，全部共享 Layer 0 的 Port 作为工具。

### 6.1 三个 Agent 的定位对照

| Agent | 触发时机 | 是否改数据 | 价值 | 实施优先级 |
|-------|---------|-----------|------|-----------|
| **A 融合自检** | 入库 Pipeline Step 2 | 改（产出新 Master Note） | 治「单篇入库质量」 | 第三做 |
| **B 知识库巡检** | 手动 / 定时 | **只读，只出建议** | 治「整体体系化」← 核心目标 | **第一做** |
| **C Q&A 检索** | Q&A 提问时 | 只读 | 提升问答体验 | 第四做（锦上添花） |

> 注意优先级：**先做 B**，因为它只读、最安全、对核心目标价值最高，且能把整套 Agent 基础设施（loop + 工具 + 状态落库 + 轨迹可视化）跑通。详见第 8 节实施顺序。

### 6.2 Agent A：融合自检 Agent

**定位**：把 Pipeline Step 2 的「一次性融合」升级为「多轮自检融合」，提升单篇入库质量。

**触发**：Pipeline Step 2，当 Master Note 已存在且新材料较复杂时。

**Agent loop 行为**：
```
1. 抽取新材料的核心知识点（列表）
2. 逐个判断每个知识点与现有 Master Note 的关系：
   全新概念 / 对已有内容的补充 / 与已有内容矛盾 / 重复
3. 决定每个知识点的插入位置
4. 生成新版 Master Note
5. 自检：有没有遗漏知识点？有没有制造矛盾？章节结构是否断裂？知识地图是否同步更新？
6. 若自检不通过 → 回到步骤 4 修正；通过 → 输出
```

**用到的工具（Port 包装）**：`NotePort.readMaster`、`LlmPort`

**关键点**：自检循环最多 N 轮（如 3 轮）防止无限循环；每轮的思考与结果落 `mindbank_agent_steps` 表，供轨迹查看。

### 6.3 Agent B：知识库巡检 Agent（核心，治「混乱」的药）

**定位**：定期巡检整个知识库，自主发现体系性问题，产出**建议报告**（不直接改，等用户审批）。这是「让知识体系化、不混乱」的真正答案。

**触发**：
- 手动：在 Agent 子 Tab 点「巡检知识库」
- 自动：后端定时任务（如每周）

**Agent loop 行为（它自主决定看哪些、怎么判断）**：
```
1. 调 NotePort.listNotes 拿到所有笔记的元信息（路径/大小/更新时间）
2. 调 NotePort.readIndex 拿到全局索引
3. 自主决定深入查看哪些笔记（如：超大的、长期没更新的、疑似重叠的）
4. 对可疑项做判断，识别以下问题类型：
   - split_note：某 Master Note 过长，建议拆分
   - merge_workspace：两个 Workspace 内容高度重叠，建议合并
   - resplit_workspace：某 Workspace 太杂，建议重新切分
   - fix_index：知识地图索引与正文漂移，建议修正
   - orphan_note：某笔记孤立 / 长期未更新，建议处理
5. 对每个问题产出一条结构化建议（描述 + 涉及笔记 + 建议操作）
6. 汇总成巡检报告
```

**用到的工具（Port 包装）**：`NotePort.listNotes / readMaster / readIndex`、`KnowledgeBasePort.query`（用于判断内容重叠度）

**最关键的设计原则**：

> **Agent B 只读、只提建议，任何执行都需用户在界面上确认（human-in-the-loop）。**

理由：
1. **安全**：只读 Agent 出错也不会破坏你的知识库数据。
2. **合理**：知识库是你的，拆分 / 合并这种重大结构调整，理应有人在回路里拍板。
3. **可作为练手场**：因为不改数据，可以放心地反复跑、调 Prompt、验证整套 Agent 基础设施。

### 6.4 Agent C：Q&A 检索 Agent（后期，锦上添花）

**定位**：把固定的「单 Workspace RAG」升级为「会查资料的 Agent」。

**触发**：Q&A Tab 提问时。

**升级点**：Agent 自己判断——
- 这个问题该查哪几个 Workspace（而非固定一个）
- 要不要追溯到 MinIO 原始文件求证
- 答不上来时，是否该建议用户去补充材料

**用到的工具**：`KnowledgeBasePort.query / queryMultiple`、`StoragePort.getOriginal`

**优先级最低**：纯体验增强，不影响知识体系性，最后做。

---

## 7. Agent 子 Tab 的界面设计

Agent 能力集成在 Mindbank 页面内，作为子 Tab「Agent 知识管家」，符合 Nexus all-in-one 定位。Mindbank 只保留它独有的功能，笔记浏览复用 Nexus 已有的全局 Obsidian 浏览页（见 7.3）。

### 7.1 界面结构

```
Mindbank 页面（三个子 Tab，均为 Mindbank 独有功能）
├── Tab：文件/入库        （上传、Crawl、看 Pipeline 处理进度）
├── Tab：Q&A             （基于知识库问答）
└── Tab：🆕 Agent 知识管家
    ├── 「巡检知识库」按钮 → 触发 Agent B
    ├── 巡检报告区
    │   └── 建议卡片列表，每条含：
    │       ├── 问题类型 + 描述
    │       ├── 涉及哪些笔记 / Workspace
    │       ├── 建议操作（拆分/合并/修正…）
    │       ├── [采纳] [忽略] 按钮
    │       └──（可选）[查看笔记] → 跳转到 Nexus 全局 Obsidian 浏览页
    ├── Agent 执行轨迹（可展开）
    │   └── 逐步展示：第N步思考 → 调用了哪个工具 → 工具返回了什么
    └── 历史巡检记录（时间线）
```

### 7.2 「Agent 执行轨迹」可视化（强烈建议做）

把 agent loop 的每一步（思考 → 选工具 → 工具结果）展示出来。价值：

- **调试**：Agent 是黑盒最痛苦，轨迹让你看清它为什么这么判断。
- **信任**：你能验证 Agent 的建议是基于什么得出的。
- **求职**：这恰恰是 AI Agent 岗位面试官最想看到你理解的东西——你不只会用，还能把 agent 的推理过程透明化。

数据来源：`mindbank_agent_steps` 表（见 8.x 数据库设计）。

### 7.3 笔记浏览：复用 Nexus 已有的全局浏览页（不在 Mindbank 内重复）

Nexus 已经有一个全局的 Obsidian 笔记浏览页，因此 Mindbank **不再单独做笔记浏览 Tab**，避免功能重复、职责更清晰。

**必须理解的一个关键区分**（否则容易误以为删了浏览页会影响 Agent）：

| | 笔记浏览页（前端） | NotePort（后端 Layer 0） |
|---|---|---|
| 给谁用 | 给**人**看 | 给 **Agent / Pipeline** 用 |
| 在哪一层 | 前端页面 | 后端共享能力层 |
| 怎么读笔记 | 调后端接口渲染给用户看 | 直接读 Obsidian vault 文件 |

Agent 读笔记的真实链路是：

```
Agent B → NotePort.readMaster() / listNotes() / readIndex() → 直接读 vault 文件
                          ↑
              纯后端能力，不经过任何前端浏览页
```

**结论**：删掉 / 不做 Mindbank 的笔记浏览 Tab，对 Agent A 的 `readMaster`、Agent B 的 `listNotes / readMaster / readIndex` **没有任何影响**。前端浏览页和后端 `NotePort` 是两回事，一个在前端、一个在 Layer 0，互不依赖。

**可选的体验增强**：Agent 巡检产出的建议卡片，可以加一个「查看笔记」链接，带上笔记路径参数**跳转到 Nexus 已有的全局浏览页**，而不是在 Mindbank 内重做浏览器。这样既复用现有页面，又把「Agent 建议」和「查看笔记」串起来。不做也不影响功能。

> 沿用 Phase 6 v2 已有的 `mindbank_workspaces` / `mindbank_documents` / `mindbank_prompt_templates` 三表。以下为 Agent 层新增三表，风格与原有 `step1~5_status` 设计一脉相承。

```sql
-- Agent 任务表（巡检/融合任务的执行记录，支持中断恢复与进度追踪）
CREATE TABLE mindbank_agent_tasks (
    id              BIGSERIAL PRIMARY KEY,
    agent_type      VARCHAR(30),    -- 'merge_check'(A) | 'inspect'(B) | 'qa'(C)
    trigger_type    VARCHAR(20),    -- 'auto' | 'manual'
    status          VARCHAR(20),    -- pending/running/awaiting_approval/done/failed
    workspace_id    BIGINT,         -- 可空（全局巡检时为空）
    summary         TEXT,           -- 任务结果摘要
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Agent 执行步骤表（agent loop 每一步，用于轨迹可视化 + 中断恢复）
CREATE TABLE mindbank_agent_steps (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT REFERENCES mindbank_agent_tasks(id),
    step_index      INT,
    thought         TEXT,           -- 模型这一步的思考
    tool_called     VARCHAR(100),   -- 调用的工具名（空=纯思考或最终结论）
    tool_input      JSONB,          -- 工具入参
    tool_output     JSONB,          -- 工具返回
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Agent 建议表（Agent B 巡检产出，等用户审批）
CREATE TABLE mindbank_agent_suggestions (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT REFERENCES mindbank_agent_tasks(id),
    suggestion_type VARCHAR(40),    -- split_note/merge_workspace/resplit_workspace/fix_index/orphan_note
    description     TEXT,           -- 问题描述
    affected_notes  JSONB,          -- 涉及的笔记/Workspace 列表
    proposed_action JSONB,          -- 建议的具体操作（结构化，采纳时据此执行）
    status          VARCHAR(20) DEFAULT 'pending',  -- pending/accepted/ignored
    created_at      TIMESTAMP DEFAULT NOW()
);
```

**设计说明**：
- `mindbank_agent_steps` 同时服务两个目的：① 前端轨迹可视化；② 长任务中断后从某步恢复。
- `status = 'awaiting_approval'` 是 Agent B 的核心状态——巡检完不直接结束，而是等用户对建议逐条 [采纳]/[忽略]。
- `proposed_action` 用 JSONB 存结构化操作，用户点「采纳」时后端据此执行真正的笔记操作。

---

## 9. 实施顺序（关键：不要一开始就上 Agent）

每个阶段都是可交付、可演示的。**严格按此顺序**，否则会陷入调试地狱。

### 阶段一：Layer 0 + Layer 1 纯 Pipeline（先不碰 Agent）

- 实现 Port 抽象层（Layer 0）
- 实现 5 步确定性 Pipeline（Step 2 先用原始单次 Prompt，**不接 Agent A**）
- 打通 Crawl 摄入 → MinIO → Pipeline → Obsidian + AnythingLLM 全链路
- **产出**：稳定的入库能力，覆盖 80% 日常价值
- **铁律**：这阶段绝不引入任何 Agent，否则确定性和非确定性混在一起，调试灾难

### 阶段二：Agent B 知识库巡检（第一个 Agent，只读 + 建议）

- 用 LangChain4j 搭建第一个 agent loop
- 实现工具（Port 包装）、状态落 `mindbank_agent_tasks/steps`、轨迹可视化
- 巡检产出建议 → 写 `mindbank_agent_suggestions` → 前端审批界面
- **为什么先做 B**：只读 + 出建议，不动数据，最安全；出错不破坏知识库；正好用它把整套 Agent 基础设施跑通验证
- **产出**：能跑的 Agent 基础设施 + 直接服务「体系化」核心目标

### 阶段三：Agent A 融合自检（接入 Pipeline Step 2）

- 基础设施在阶段二已验证，此时把融合自检接进 Step 2 水到渠成
- 实现「是否走 Agent A」的判断策略（见 5.2）
- **产出**：入库质量提升

### 阶段四：Agent C Q&A agentic 检索（锦上添花）

- 把 Q&A 从固定单 Workspace RAG 升级为 agentic 检索
- **产出**：问答体验提升

### 实施顺序的精髓

> **先抽 Port（地基）→ 确定性 Pipeline 跑稳（主干）→ 只读巡检 Agent 练基础设施（最安全的第一个 Agent）→ 再逐步把 Agent 接进高价值环节。**

---

## 10. 技术栈与依赖确认

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | React 18 + Vite + TS + Tailwind + shadcn/ui | Mindbank 页面 + Agent 子 Tab |
| 后端 | Spring Boot 3.x + Java 21 + MyBatis-Plus | 命令式（非响应式），与 AgentScope-Java 不兼容正是放弃它的原因之一 |
| AI 编排 | **LangChain4j** | Pipeline 的 LLM 调用 + Agent 的 loop/工具/memory，全部自建于此 |
| 知识库 | AnythingLLM + LanceDB | 经 KnowledgeBasePort 接入，未来可换 PGVector |
| 存储 | MinIO（NAS）| 经 StoragePort 接入 |
| 笔记 | Obsidian vault | 经 NotePort 接入 |
| 摄入 | Crawl4AI + MarkItDown | 经 CrawlPort 接入 |
| 数据库 | PostgreSQL 16 | Pipeline 状态 + Agent 任务/步骤/建议 |

**明确不引入**：AgentScope-Java（响应式冲突 + 功能重叠 + 过重）、Pi（CLI 形态不适合内嵌；可作为开发者手动运维工具单独使用）。

---

## 11. 设计决策速查（便于日后回顾）

| 决策 | 选择 | 一句话理由 |
|------|------|-----------|
| 整体架构 | Pipeline + Agent 双层 | 确定的事走 Pipeline，需判断的事走 Agent |
| 是否全 Agent 化 | 否 | 入库是高频路径，Agent 成本/不确定性不该花在这 |
| Agent 框架 | LangChain4j 自建 | 需求轻且领域专一，自建更简洁可控、可解释 |
| 排除 AgentScope-Java | 是 | 响应式与命令式代码库冲突 + 与 LangChain4j 重叠 + 过重 |
| 排除 Pi 当底座 | 是 | CLI 形态不适合内嵌；但可当开发者手动运维工具 |
| 第一个做的 Agent | Agent B 巡检 | 只读最安全，且直接服务「体系化」核心目标 |
| Agent 是否自动改数据 | 否（巡检层）| 重大结构调整需 human-in-the-loop |
| Agent 位置 | Mindbank 子 Tab | Nexus all-in-one，不切换工具 |
| 笔记浏览 | 复用 Nexus 全局浏览页 | 避免重复；与 Agent 读笔记（NotePort）无关 |
| 地基第一步 | 抽 Port 层 | Pipeline 与 Agent 共享能力，不重复造轮子 |

---

## 12. 待细化项（进入开发后逐步补充）

- [ ] Agent loop 的最大步数 / 自检最大轮数具体阈值
- [ ] Agent B 巡检触发的定时频率（每周？）
- [ ] 「内容重叠度」判断的具体方法（靠 KnowledgeBasePort.query 相互检索打分？还是 embedding 相似度？）
- [ ] Agent A 接入 Step 2 的「材料复杂度」阈值（token 数？还是知识点数量？）
- [ ] 建议「采纳」后，结构操作（拆分/合并笔记）的具体执行逻辑与回滚机制
- [ ] Agent 用哪个模型（巡检判断需要较强推理，成本要平衡）
- [ ] 长任务中断恢复：从 mindbank_agent_steps 恢复上下文的具体实现
- [ ] Agent 轨迹的前端展示组件（复用 Pipeline 状态追踪的 UI 风格？）

---

## 附录 A：与 Phase 6 v2 文档的关系

本文档**不替代** Phase 6 v2，而是**在其上增加 Agent 运维层并明确双层架构**：

- Phase 6 v2 的 Crawl 摄入、MinIO 结构、5 步 Pipeline、Master Note 融合理念、Workspace 组织、Q&A 流程、Notes 页面 → **全部保留**
- 本文档新增：Layer 0 Port 层的明确化、Layer 2 Agent 运维层、Agent 子 Tab、Agent 相关数据表、双层架构思想、框架选型决策记录
- Phase 6 v2 的 Step 2 → 本文档将其升级为「可选融合自检」

开发时两份文档配合使用：Phase 6 v2 看入库细节，本文档看整体架构与 Agent 设计。
