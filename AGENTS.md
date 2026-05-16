# Floris AI Agent 开发协作说明

## 项目目标

Floris AI 是一个 macOS desktop app，核心交互是 chat。第一阶段聚焦 code agent：用户通过 chat 发起任务，agent 可以理解项目、读写代码、运行命令、解释修改，并在用户参与下逐步完成软件开发。

产品参考方向：

- Codex：chat thread 是主要工作界面，agent loop 和客户端交互协议要清晰分层。
- Amp Code：agent 的核心是 LLM + system prompt + tools；用小而聚焦的 thread 控制 context window；通过 Oracle 这类专职 agent 把复杂计划、debug、review 分给更合适的模型。
- Pi Coding Agent：保持小内核，通过 extensions、skills、prompt templates、sessions、compaction 组合能力；能力按需加载，避免一次性把所有说明塞进 system prompt。

参考资料：

- Amp: How to Build an Agent: https://ampcode.com/notes/how-to-build-an-agent
- Amp: Context Management: https://ampcode.com/guides/context-management
- Amp: Agents for the Agent: https://ampcode.com/notes/agents-for-the-agent
- Pi docs: https://pi.dev/docs/latest
- Pi compaction: https://pi.dev/docs/latest/compaction
- Pi session format: https://pi.dev/docs/latest/session-format

## 语言和沟通风格

- 使用简洁、直接、积极的创业团队口吻。
- 使用软件开发领域的准确表达。不好翻译的词保持 English 原语，例如 agent、thread、context window、token、memory、tool、extension、session、prompt、handoff、provider。
- 不使用生硬或容易误导的软件术语翻译。
- 不使用大厂黑话，尤其避免用户在项目说明中列出的禁用表达。
- 讨论架构时先讲问题、约束和 trade-off，再给结论。
- 代码讲解采用教学形式：解释为什么这样做、替代方案是什么、我们暂时不做什么。

## 协作方式

我们采用人机 pair programming。每个重要开发步骤都需要先讨论，再实现，再复盘。

每轮开发默认包含：

1. 目标：这一轮要解决什么，不解决什么。
2. 设计：涉及哪些模块，数据如何流动，主要 trade-off 是什么。
3. 实现：按小步提交代码，避免一次性大改。
4. 教学说明：解释关键代码、设计意图、后续可扩展点。
5. 验证：说明运行了什么检查，结果如何，没验证的风险是什么。

如果需求不清楚，先给出可选方案和推荐方案，再让用户决定。不要在关键架构点上默默做大决定。

## 第一阶段范围

第一阶段只做 macOS desktop app，不做 Web、iOS、Android、server hosted 产品。

第一阶段 code agent 的最小能力：

- Chat thread：用户和 agent 的主交互流。
- Agent loop：发送 prompt、接收 assistant message、处理 tool call、回写 tool result、继续推理。
- Project workspace：Project 使用稳定 ID，当前目录只是可迁移的 workspace path；历史 thread 绑定 `projectId`，不直接绑定绝对路径。
- Conversation branching：支持从任意 message 创建可见对话分支，分支可以独立继续运行。
- File tools：读取文件、搜索文件、按 patch 修改文件。
- Shell tool：运行受控命令，默认需要清晰展示命令和结果。
- Session persistence：保存 thread、message、tool call、tool result、model usage。
- Context management：追踪、查看、裁剪、编辑 context window，支持自动 compaction。
- Memory 管理：区分项目规则、长期偏好、当前任务状态、历史 session 摘要，并支持查看、编辑、删除。

暂不作为第一阶段目标：

- 多平台客户端。
- 云端协同编辑。
- 完整 plugin marketplace。
- 大规模 multi-agent 自动调度。
- agent 自动调度和自主拆任务。
- 长期自动任务。

## 目录结构

Floris AI 使用 monorepo。顶层目录必须表达产品分层：macOS desktop app 是用户入口，agent runtime 是可复用能力包，docs 是共同开发和教学资料。

当前目录结构：

```text
fate-ai/
  apps/
    mac-desktop/
      FateAI/
        App/
        AgentBridge/
        Features/
          Chat/
        Resources/
        Settings/
      FateAITests/
  packages/
    agent-runtime/
      src/
        context/
        core/
        demo/
        hooks/
        memory/
        permissions/
        prompts/
        providers/
        session/
        tools/
        types/
      tests/
  docs/
    architecture/
    plans/
    teaching/
```

目录职责：

- `apps/mac-desktop`：SwiftUI macOS app。负责窗口、chat UI、用户确认、project picker、settings、和 runtime bridge。
- `apps/mac-desktop/FateAI/AgentBridge`：Swift app 和 TypeScript runtime 的进程 / RPC 边界。不能实现 agent loop。
- `packages/agent-runtime`：TypeScript agent runtime。负责 agent loop、provider、tool registry、hooks、prompt management、context、memory、session、permission gate。
- `docs/architecture`：长期架构、实现范式和跨 lesson 约束。
- `docs/plans`：具体 lesson 或功能的实现计划和状态。
- `docs/teaching`：教学规划、教学笔记和实现拆解。

边界规则：

- SwiftUI app 不直接调用 model provider，不直接执行 agent loop。
- TypeScript runtime 不实现 macOS UI。
- Agent loop 代码只能放在 `packages/agent-runtime`。
- macOS app 和 runtime 的通信协议后续单独写入 architecture 文档。
- 不允许把 `packages/agent-runtime` 放回 root；root 只放产品级目录、全局文档和编辑器配置。

## TypeScript 类型管理

`packages/agent-runtime` 的所有 TypeScript 类型和类型编程必须集中管理。

规则：

- 类型文件统一放在 `packages/agent-runtime/src/types/`。
- 类型文件统一使用 `xxx.type.ts` 命名，例如 `agent.type.ts`、`provider.type.ts`、`tool.type.ts`。
- 实现文件不定义 `type`、`interface`、复杂泛型工具类型或 discriminated union。
- 实现文件只能通过 `import type` 从 `src/types/*.type.ts` 引入类型。
- runtime 的跨模块 contract 必须先进入 `src/types`，再由实现文件使用。
- 只有极小的函数内部临时类型推断可以留在实现代码里，不允许写成命名类型。
- 如果某个类型只被一个模块使用，也仍然放进对应领域的 `.type.ts` 文件。
- 类型文件可以导出 type、interface、type-level helper，但不能包含运行时代码。

Runtime schema 规则：

- 默认使用 ArkType 定义 runtime validation schema。
- TypeScript 类型和 runtime schema 尽量从同一个 ArkType contract 推导。
- 不默认使用 Zod。
- 只有以下情况允许使用 Zod：
  - 第三方 framework / SDK 明确要求 Zod schema。
  - 已有生态工具只能消费 Zod schema。
  - 某个边界已经由外部库返回 Zod schema，转换成本高且收益低。
- 不允许同一份 contract 同时维护 ArkType 和 Zod 两套 schema，除非是明确的 adapter 层。
- ArkType 是 Floris AI 内部 contract 的默认 runtime schema；provider adapter 负责把内部 schema 转成外部 API 需要的 schema shape。

Runtime factory 和错误处理规则：

- 核心 runtime 的选择、创建和分发逻辑优先使用明确的 typed options 或参数，例如 `providerType`。不要用 callback 高阶函数隐藏主流程，否则阅读代码时需要频繁跳转，review 成本高。
- 如果确实需要 callback / factory function 作为 extension boundary，先和用户讨论原因、边界和替代方案，再写入代码。
- 错误信息必须准确保留到调用方。不要 `instanceof Error` 后吞掉错误并返回 `undefined`，再让上层包装成泛化的 `provider_unavailable` 之类错误。
- provider、config、env、secret 这类边界要返回结构化错误，至少包含稳定 `code` 和可读 `message`，方便 demo、UI 和测试直接定位问题。
- 过程日志必须通过明确的 `DEBUG` 参数控制，默认 `false`。示例、demo 或排查脚本可以显式传 `DEBUG: true`，但 runtime 内部不能默认打印。
- 调试日志格式统一为 `HH:mm:ss sss[groupName][step] message`。`groupName` 必须表达运行阶段，例如 `config`、`provider`、`agentLoop`、`tool`、`context`、`session`，不能用 `demo` 这类低信息量名称。日志内容保持简洁；object 必须格式化输出，不能把大对象压成一行。

推荐分组：

- `agent.type.ts`：`AgentProfile`、agent role、agent role definition、model policy。
- `prompt.type.ts`：prompt template、system prompt ref、prompt store。
- `message.type.ts`：message、tool call、tool result。
- `runtime.type.ts`：loop state、run input、run result、stop reason。
- `provider.type.ts`：model request、model event、provider transport。
- `tool.type.ts`：tool definition、tool execution context。
- `hook.type.ts`：hook event、hook payload、hook result。
- `context.type.ts`：context section、context snapshot。
- `memory.type.ts`：memory entry、memory scope、memory type。
- `session.type.ts`：session event、thread、branch。
- `permission.type.ts`：permission request、decision、rule。

## 双层架构

Floris AI 第一阶段采用明确的双层架构：**SwiftUI macOS App + TypeScript Agent Runtime**。

这只是开发期架构分层，不是最终用户感知的产品形态。最终形态必须是一个独立打包、可分发、可安装的 macOS desktop app。TypeScript agent runtime 应作为 app 内置 runtime 随 macOS app 一起分发，用户不需要理解 monorepo、TypeScript package 或单独启动 runtime。

```text
SwiftUI macOS App
  -> native desktop shell
  -> chat UI
  -> window / settings / permissions
  -> native file picker
  -> user confirmation UI
  -> runtime bridge

TypeScript Agent Runtime
  -> agent loop
  -> tool registry
  -> prompt management
  -> provider adapters
  -> context builder
  -> compaction
  -> memory logic
  -> session format
  -> extension / skill system
```

### SwiftUI macOS App

位置：`apps/mac-desktop`

职责：

- chat UI。
- window、sidebar、settings。
- project picker 和 workspace relocate UI。
- permission / approval UI。
- context inspector、memory library、branch UI。
- 和 TypeScript runtime 的进程 / RPC 通信。
- macOS 原生能力接入，例如文件选择器、菜单栏、通知。

限制：

- 不实现 agent loop。
- 不直接调用 model provider。
- 不直接执行 tool orchestration。
- 不直接拼接 model context。
- 不绕过 runtime 执行 file write 或 shell command。

### TypeScript Agent Runtime

位置：`packages/agent-runtime`

职责：

- agent loop。
- tool registry。
- prompt templates、system prompt selection、prompt store。
- provider adapter 和 provider transport。
- context builder。
- hooks。
- permission gate 接入点。
- memory selection 和 compaction。
- session event 和 branch tree 数据结构。
- extension / skill system 的内部扩展点。

限制：

- 不实现 macOS UI。
- 不直接依赖 SwiftUI 或 AppKit。
- 不直接依赖 macOS Keychain。第一阶段 API key 使用平台无关的本地加密配置；后续可通过 `SecretStore` adapter 让 macOS app 提供 Keychain backend。
- 不绕过 macOS app 的用户确认 UI 执行高风险操作。

### Bridge 边界

位置：`apps/mac-desktop/FateAI/AgentBridge`

推荐方向：

- Swift app 启动 TypeScript runtime 进程。
- 两层通过 JSON-RPC 或等价 event protocol 通信。
- runtime 输出 `AgentEvent`，Swift UI 订阅并渲染。
- Swift UI 发送 user message、interrupt、approval decision、context edit、memory edit。
- 所有跨层消息都应该可记录、可重放、可测试。

Bridge 不能承载业务决策。它只负责进程生命周期、消息编码、stream 转发和错误映射。

### 最终分发形态

最终产品要求：

- 提供独立 macOS app bundle。
- 用户通过一个 app 启动 Floris AI。
- TypeScript runtime、必要的 JS bundle、工具配置和资源随 app 打包。
- 首次启动不要求用户手动安装 Bun、Node 或运行命令。
- 开发期 TypeScript tooling 限定在 `packages/agent-runtime` 内；分发期必须通过 build pipeline 产出 app 内可运行的 runtime artifact。
- app 内部仍保留 SwiftUI shell 和 TypeScript runtime 的边界，方便测试、升级和问题定位。

## 架构原则

### 1. Chat 是产品核心，不是外壳

Chat thread 不是普通消息列表，而是 agent 的工作记录。每条 message、tool call、tool result、用户确认、文件修改都应该可以追溯。

推荐数据模型：

- `Project`：稳定项目身份，包含 `id`、`name`、`identityFingerprint`、`currentWorkspacePath`、`previousWorkspacePaths`、`gitRemoteUrls`、`gitRootFingerprint`。
- `Thread`：一次任务或一条长期会话，承载一棵可分支的对话树。
- `Branch`：thread 中一条可运行工作线，包含 `id`、`threadId`、`parentBranchId`、`forkedFromEntryId`、`title`、`activeAgentId`、`windowState`。
- `Entry`：branch 中的树状节点，支持 fork、restore、handoff。
- `MessageEntry`：user / assistant / tool result。
- `ToolCallEntry`：tool name、input、status、output summary。
- `ContextSnapshot`：某次 agent invocation 实际使用的 context entries、memory entries、files、token 估算。
- `CompactionEntry`：旧上下文摘要、保留起点、压缩前 token 数。
- `MemoryEntry`：项目规则、用户偏好、架构决策、重要经验。

`Thread` 必须绑定 `projectId`，不能只绑定 workspace path。`workspacePathSnapshot` 只用于解释历史发生在什么目录下，不作为项目身份。

`Branch` 是第一阶段的核心能力，不是隐藏后台机制。用户可以看见、命名、切换、关闭和恢复分支。第二阶段 multi-agent 任务拆分可以把不同 agent 绑定到不同 branch，并允许多窗口独立运行。

文件引用必须同时保存 `relativePath` 和当时的 `workspacePathSnapshot`。有条件时再保存 `fileFingerprint` 或 `gitBlobSha`，方便目录迁移或文件移动后做 lazy resolution。

### 2. Agent runtime 和 UI 分离

SwiftUI 负责展示和交互，agent runtime 负责状态机和 tool orchestration。不要让 View 直接调用 model provider 或执行 shell。

建议模块边界：

- `App`: macOS app lifecycle、window、settings。
- `ChatUI`: thread 列表、message view、composer、tool call 展示。
- `AgentCore`: agent loop、tool registry、context builder、event stream。
- `ModelProvider`: OpenAI、Anthropic、本地模型等 provider adapter。
- `Tooling`: file、search、edit、shell、git 等 tools。
- `Workspace`: 项目目录、文件索引、权限策略。
- `Memory`: project memory、session summary、retrieval、compaction。
- `Persistence`: SQLite 或 SwiftData 存储 thread、entry、memory、settings。

### 3. Workspace 可迁移

Project identity 和 workspace path 必须分离。目录迁移后，用户应该能把旧 Project 重新指向新目录，历史 thread、memory、session summary 不应丢失。

推荐交互：

- 在 Project Settings 提供 `Relocate Workspace`。
- 用户选择新的本地目录。
- 系统用 `.git/config` remote、最近 commit、workspace manifest、关键文件 fingerprint 等信息判断是否像同一个项目。
- 如果匹配度高，更新 `currentWorkspacePath`，并把旧目录加入 `previousWorkspacePaths`。
- 如果无法确认，展示风险并要求用户明确确认。

路径解析规则：

- 新 tool call 默认使用 `currentWorkspacePath`。
- 历史 tool call 展示当时的 `workspacePathSnapshot`。
- 历史文件引用优先用 `relativePath` 在当前目录解析。
- 如果相对路径不存在，再尝试用 `fileFingerprint`、`gitBlobSha` 或历史路径提示用户文件可能已移动。
- 不允许因为目录迁移创建新的 Project，除非用户明确选择新建。

### 4. 小内核，可扩展

参考 Pi 的思路，核心 runtime 只保留稳定抽象：

- `AgentLoop`
- `Message`
- `Tool`
- `ToolRegistry`
- `ContextBuilder`
- `MemoryStore`
- `SessionStore`
- `ProviderAdapter`

复杂能力通过 extension-like 机制逐步加入。第一阶段可以先用 Swift protocol 实现内部扩展点，不急着做公开 plugin API。

### 5. Tools 要少而清楚

不要把几十个 tool 一次性暴露给 model。第一阶段优先提供少量高价值 tool：

- `read_file`
- `search_files`
- `list_files`
- `apply_patch`
- `run_shell`
- `git_status`

每个 tool 必须有：

- 简洁 description。
- 严格 input schema。
- 明确权限边界。
- 输出摘要和完整输出引用。
- token 预算策略，长输出必须截断并可继续读取。

### 6. Memory 分层

不要把 memory 当成一个大文本文件。第一阶段至少区分四层：

- Project instructions：例如本文件、项目编码规范、架构边界。启动时加载，保持短。
- Working memory：当前 thread 中近期 message 和 tool result。
- Session summary：compaction 后的任务摘要、已改文件、关键决策、未完成事项。
- Long-term memory：用户偏好、项目长期架构决策、反复出现的经验。

Memory 写入要谨慎。默认只有稳定事实、用户明确偏好、架构决策、踩坑记录可以进入 long-term memory。

### 7. Token 优化优先级

Token 优化不是后期性能工作，而是 agent 产品质量的一部分。

默认策略：

- system prompt 保持短，只放长期稳定规则。
- tool definitions 保持少，只启用当前任务需要的 tools。
- 文件内容按需读取，优先搜索和片段读取。
- shell 输出默认摘要，保留原始输出引用。
- 大文件读取设置行数和字节上限。
- thread 过长时自动 compaction，保留最近上下文和关键文件状态。
- handoff 用于把长 thread 的关键内容转移到新 thread。
- `@agent` 显式调用用于把复杂分析、review、debug 交给更适合的模型，避免主 agent 承担所有 token 成本。

### 8. 对话分支是高级用户能力

对话分支用于让开发者和高级用户自由探索不同方案。它不是隐藏后台任务，也不是让用户看不见的内部 agent 流程。

第一阶段必须支持：

- 从任意 user message、assistant message、tool result 创建 branch。
- 每个 branch 有独立 title、active agent、context policy、运行状态。
- branch 可以在同一个窗口切换，也要为未来多窗口同时运行预留状态。
- branch 创建时继承 fork point 之前的 entries、project memory 和 workspace 状态。
- branch fork point 之后的 message、tool call、file edit、context snapshot 必须独立记录。
- 用户可以比较不同 branch 的结果，尤其是文件修改、测试结果和 agent 结论。

分支规则：

- 默认分支名可以来自 fork message 摘要，用户可改名。
- branch 不是复制一整份历史，而是用 `parentBranchId` + `forkedFromEntryId` 表示继承关系。
- 构建 context 时，只取当前 branch 路径上的 entries，再按策略加入 memory 和文件片段。
- 文件写入仍然发生在同一个 workspace。执行会改文件的 branch 需要明确展示将要修改的内容，避免用户不知道哪个分支改了真实文件。
- 第二阶段可以让不同 agent 绑定不同 branch 独立运行，但第一阶段只做用户显式创建和显式运行。

### 9. Context window 可查看、可裁剪、可编辑

Context window 必须对高级用户透明。用户应该能看到下一次 agent invocation 会带入哪些内容，以及这些内容大概消耗多少 token。

第一阶段必须支持：

- Context Inspector：展示 system prompt、agent profile、recent messages、selected summaries、memory entries、file snippets、tool definitions。
- Token estimate：按 section 展示估算 token，至少区分 messages、tools、files、memory、system prompt。
- Include / exclude：用户可以临时排除某条 message、某段 tool output、某个 memory 或某个 file snippet。
- Conversation trimming：用户可以从某个 message 开始裁剪当前 branch 的上下文，保留历史记录但不再带入 prompt。
- Manual summary：用户可以编辑 compaction summary，替换自动摘要。
- Context snapshot：每次 agent invocation 保存实际发送的 context 结构，方便回放和 debug。

编辑规则：

- 编辑 context 只影响后续 model input，不改写原始历史记录。
- 被排除的历史 entry 仍然存在，可以恢复。
- 用户编辑过的 summary 要记录 `editedByUser` 和时间。
- Context Inspector 不能显示 secret 原文；如果 tool result 里包含 credential，要脱敏。
- 默认策略要简单：最近对话 + 当前 branch summary + 相关 memory + 按需文件片段。

### 10. Memory 可查看、可管理、可编辑

Memory 是用户可管理的数据，不是 agent 私自维护的黑盒。

第一阶段必须支持：

- Memory Library：查看 project instructions、session summaries、long-term memory。
- 新增、编辑、禁用、删除 memory entry。
- 按 scope 管理：global、project、thread、branch。
- 按 type 管理：preference、architecture decision、coding rule、known issue、summary。
- 每条 memory 记录来源：用户手写、agent 建议、compaction 生成、从文档导入。
- agent 想写入 long-term memory 时，默认需要用户确认。

Memory 规则：

- project instructions 是高优先级，但要保持短。
- session summary 服务 context 压缩，不等同于长期记忆。
- long-term memory 只保存稳定事实、用户偏好、架构决策和重复出现的问题。
- memory entry 必须能被禁用，不需要立即删除。
- Context Builder 每次选择 memory 时，要记录选择理由和 token 估算。

## Multi-agent 设计方向

第一阶段不做 agent 自动调度。我们要实现的是用户可见、各司其职的 multi-agent：不同 agent 有不同职责、tool scope、system prompt、model policy 和 token budget，用户通过输入框里的 `@agent` 显式调用。

这个设计参考 Amp Oracle：主 agent 继续承担日常编码和执行，更强但更贵或更慢的模型用于复杂计划、debug、review、架构分析。Oracle 不应该默认参与每个请求，而是在用户明确要求或任务明显需要时使用。

第一阶段推荐内置 agents：

- `@coder`：默认主 agent，负责日常代码实现、文件修改、命令执行和用户沟通。使用速度、成本、执行能力更均衡的模型。
- `@oracle`：高推理 agent，负责复杂计划、debug、架构分析、review。默认 read-only，不直接修改文件。使用更强但更贵或更慢的模型。
- `@reviewer`：review agent，负责检查 diff、风险、缺失测试、行为回归。默认 read-only。
- `@explorer`：代码搜索 agent，负责定位模块、调用关系、相关文件和上下文摘要。默认 read-only，优先使用低成本模型。

使用规则：

- 输入框支持 `@coder`、`@oracle`、`@reviewer`、`@explorer` mention。
- 没有 mention 时默认走 `@coder`。
- agent mention 会决定本轮使用的 system prompt、model、tools、context budget 和输出格式。
- read-only agent 不能调用 `apply_patch`、高风险 shell command 或 destructive command。
- agent 的完整推理过程不进入主 context，只保存结构化 summary、关键引用、文件路径、风险和验证结果。
- 同一 thread 可以包含多个 agent 的消息，但每条消息必须记录 `agentId`、`modelId`、token usage 和 tool scope。
- `@oracle` 主要用于计划、debug、review、架构判断，不作为默认编码执行者。
- `@explorer` 输出应该短，优先给文件路径、符号、调用关系和下一步建议。

建议数据模型：

- `AgentProfile`：`id`、`displayName`、`role`、`systemPrompt`、`model`、`allowedTools`、`contextPolicy`、`writeAccess`。
- `AgentRoleDefinition`：`role`、`displayName`、`systemPrompt`、`defaultModel`、`defaultAllowedTools`、`defaultContextPolicy`、`defaultWriteAccess`。
- `PromptTemplate`：`id`、`kind`、`version`、`title`、`content`、`variables`。
- `AgentInvocation`：`threadId`、`agentId`、`modelId`、`inputMessageId`、`contextEntryIds`、`status`、`tokenUsage`。
- `AgentMessageEntry`：记录某个 agent 的 assistant message、summary、引用、tool calls。

API key 第一阶段先使用平台无关的本地加密配置保存，不绑定 macOS Keychain。后续可以按平台提供更安全的 secret backend，但 provider 和 agent runtime 不能直接依赖某个系统的 credential API。

第一阶段先实现显式 `@agent` 调用和 agent profile 配置。不要实现 agent 自主选择另一个 agent，也不要实现复杂 multi-agent 工作流。后续可以在用户确认下，让 `@coder` 请求 `@oracle` 做 review 或计划。

后续 multi-agent 是 Floris 的差异化方向，不以隐藏后台 subagent 为主设计。multi-agent 任务拆分必须优先绑定到可见 branch、shared work graph 和独立窗口，让用户理解每个 agent 正在做什么、基于什么 context、会修改哪些文件。不同 agent 可以协作沟通，并能在权限允许时跨 session 补充 context，但复杂工作不能放进用户看不见的后台流程。

## 课程规划

课程规划由独立文档维护，AGENTS.md 只保留入口，避免路线在多个文件里重复导致漂移。

- 总路线：[docs/plans/lesson-roadmap.md](docs/plans/lesson-roadmap.md)
- Lesson 1 实现计划：[docs/plans/lesson1-mvp-agent-loop.md](docs/plans/lesson1-mvp-agent-loop.md)
- Lesson 1 教学规划：[docs/teaching/lesson1/README.md](docs/teaching/lesson1/README.md)
- Lesson 1 教学笔记：[docs/teaching/lesson1/notes.md](docs/teaching/lesson1/notes.md)
- Lesson 1 实现拆解：[docs/teaching/lesson1/implementation-breakdown.md](docs/teaching/lesson1/implementation-breakdown.md)
- Lesson 1 tool 架构：[docs/teaching/lesson1/tool-architecture.md](docs/teaching/lesson1/tool-architecture.md)

新增、调整或完成课程小节时，先更新对应 lesson 文档，再按需在这里补充入口链接，不在 AGENTS.md 里复制章节细节。

Hooks 设计先保持内部 typed hooks。架构文档必须记录每个 hook 的触发时机、输入输出、是否允许修改 context、是否允许阻止流程。将来开放 extension 或用户脚本时，以这些文档作为兼容依据，不能临时改变 hook 语义。

## 教学式开发要求

每次代码实现后，必须给用户讲清楚：

- 新增或修改了哪些文件。
- 核心类型和函数各自负责什么。
- 数据从用户输入到 model，再到 tool，再回到 UI 的路径。
- 哪些代码是当前阶段的简化版。
- 后续扩展时应该改哪里，不应该改哪里。

解释代码时优先引用具体文件和函数，不做空泛总结。

## Swift/macOS 开发约定

- UI 默认使用 SwiftUI。
- 异步流程使用 Swift Concurrency。
- 状态变更要集中，避免 View 内部散落业务逻辑。
- 持久化优先考虑 SQLite 或 SwiftData；选择前需要讨论 schema、迁移和可测试性。
- agent runtime 应能脱离 UI 做单元测试。
- shell 和 file write 必须经过权限层，不允许 UI 绕过 runtime 直接执行。
- 所有跨进程、文件系统、shell 操作都要可记录、可展示、可取消。

## 安全和权限

Code agent 默认运行在用户本机项目目录内，但权限模型必须保持最小范围安全。参考 Codex 的 sandbox / approval 思路：低风险操作自动执行，超出默认范围的操作先交给专职审核 agent 判断；审核 agent 不能放行时，再请求用户授权。

核心原则：

- 默认权限必须保守，不能提供“完全授权”模式。
- 用户可以在 global 或 project scope 配置固定开放规则，但规则必须有明确边界。
- 所有 tool call 都要经过权限层，不允许 UI 或 agent runtime 绕过。
- 所有 permission decision 都要记录，方便用户审计和回放。
- API key、token、credential 不进入 prompt、不写入日志。
- Tool result 中发现 secret 时要做脱敏展示。

默认权限：

- 允许读取当前 workspace 内的普通文本文件，但要尊重 ignore rules 和 secret detection。
- 允许搜索当前 workspace。
- 允许写入当前 workspace 内的普通项目文件，但要通过 patch，并展示 diff。
- shell 默认只允许低风险只读命令，例如 `pwd`、`ls`、`git status`、`git diff`、`rg`。
- 不允许写入 workspace 外部路径，除非用户对具体路径授权。
- 不允许 destructive command、Git history 重写、credential 读取、系统设置修改、未知网络安装。

权限审核流程：

1. Tool call 进入 `PermissionGate`。
2. `PermissionGate` 先匹配 global 和 project 的固定开放规则。
3. 如果命中允许规则，直接执行并记录 decision。
4. 如果命中拒绝规则，直接拒绝并说明原因。
5. 如果没有命中规则，但操作超出默认最小权限，交给 `PolicyReviewer`。
6. `PolicyReviewer` 只接收结构化信息：tool name、cwd、目标路径、命令摘要、风险标签、agentId、projectId，不接收 secret 原文。
7. `PolicyReviewer` 可以返回 allow、deny、needsUserApproval。
8. 只有 allow 才能自主放行；deny 直接拒绝；needsUserApproval 必须弹出用户授权 UI。

`PolicyReviewer` 是专职审核 agent，不参与写代码，不修改文件，不运行 shell。它的目标是判断一次 tool call 是否在已知安全边界内，而不是帮助主 agent 完成任务。

固定开放规则：

- 支持 global scope 和 project scope。
- 支持按 tool、command prefix、workspace relative path、file extension、network domain 设置规则。
- 支持 allow 和 deny，deny 优先级高于 allow。
- 支持过期时间和使用次数限制。
- 不支持“允许所有命令”“允许所有路径”“永远完全授权”这类规则。

建议数据模型：

- `PermissionRule`：`id`、`scope`、`projectId`、`effect`、`toolName`、`commandPrefix`、`pathPattern`、`networkDomain`、`expiresAt`、`maxUses`、`createdBy`。
- `PermissionDecision`：`toolCallId`、`decision`、`source`、`ruleId`、`reviewerAgentId`、`reason`、`createdAt`。
- `PolicyReviewRequest`：`toolCallId`、`agentId`、`toolName`、`cwd`、`targetPaths`、`commandSummary`、`riskTags`。
- `PolicyReviewResult`：`decision`、`reason`、`requiredUserApprovalFields`。

高风险操作必须用户确认，不能只靠审核 agent 放行：

- 删除大量文件或删除 workspace 外文件。
- 修改 shell profile、系统设置、Keychain、SSH config。
- 读取或打印 credential。
- `git reset --hard`、force push、history rewrite。
- 安装或执行未知远程脚本。
- 改动 package manager lockfile 且会触发大量依赖变化。
- 访问未配置允许的网络域名。

用户授权 UI 必须展示：

- 请求的 agent。
- tool name。
- command 或目标路径。
- 影响范围。
- 审核 agent 的判断理由。
- 可选授权时长和 scope。

用户可以把一次授权保存为固定规则，但 UI 必须让边界具体可见，例如“允许本项目运行 `go test`”或“允许本项目写入 `Sources/**`”，不能提供无边界授权。

## 文档约定

重要设计要写成 Markdown，放在 `docs/` 下。建议结构：

- `docs/architecture/agent-runtime.md`
- `docs/architecture/agent-loop-implementation-paradigm.md`
- `docs/architecture/lesson-readme-writing-guidelines.md`
- `docs/architecture/context-memory.md`
- `docs/architecture/session-format.md`
- `docs/architecture/tooling.md`
- `docs/plans/`：每个 lesson 或功能的具体实现计划、状态和验收清单。
- `docs/teaching/`：每轮教学笔记和实现拆解。

每个 lesson 默认包含：

- `docs/teaching/lessonN/README.md`：教学规划，比 `AGENTS.md` 更详细，包含参考资料、方案对比、学习目标和验收标准。
- `docs/plans/lessonN-*.md`：具体实现计划，包含步骤、文件清单、测试命令、状态和完成标准。
- `docs/teaching/lessonN/notes.md`：实现过程中同步更新的教学笔记，让用户能独立理解和重写。
- `docs/teaching/lessonN/implementation-breakdown.md`：代码完成后基于真实代码和运行结果写的实现拆解。

Lesson tag 规则：

- 每个 lesson 的可学习实现步骤都要打 tag，方便学习者按 tag 查看实现过程。
- 修改 lesson 文档或实现时，必须说明新增能力对应哪个 lesson 小节，以及对应哪个 tag。
- 一个 tag 可以覆盖多个小节，但文档必须明确覆盖范围，例如 `Lesson 1.1` 到 `Lesson 1.3`。
- 如果某个小节只是为了 demo 提供支撑代码，不能写成该小节完整实现。要使用 `partial`、`supporting` 或等价准确表述。
- 后续增强同一 lesson 时，要在 plan、notes 或 implementation breakdown 中补充“小节 -> tag”的对应关系，不能只写一段泛化总结。

每个设计文档默认包含：

- 背景
- 目标
- 非目标
- 方案
- 数据模型
- 关键流程
- trade-off
- 测试策略
- 后续问题

修改任何 `docs/teaching/lessonN/README.md` 前，必须先阅读并严格遵循 `docs/architecture/lesson-readme-writing-guidelines.md`。该约束只针对 Lesson README，不要求修改 plan、notes、implementation breakdown 或代码时读取该文档。

## Agent Loop 实现范式约束

所有涉及 agent loop 的设计、实现、重构、review，都必须先阅读 `docs/architecture/agent-loop-implementation-paradigm.md`，并遵守其中的实现范式。

适用范围包括：

- `packages/agent-runtime/src/core/agent-loop.ts`
- agent loop 状态机
- loop stop reason
- hooks 和 hook runner
- provider adapter 和 provider transport
- context builder
- session event
- tool execution path
- permission gate 接入点

默认约束：

- agent 差异用 `AgentProfile` 数据表达，不用 subclass 表达。
- agent loop 只通过 `ModelProvider` 调用模型，不直接调用 SDK。
- tool 只通过 `ToolRegistry` 执行。
- hooks 使用 typed event pipeline，不使用继承覆写流程。
- runtime 输出以 `AgentEvent` 为主，UI、session、debug 都消费 event。
- 状态转换优先使用可测试函数，避免把流程藏进大型 mutable class。

如果某次实现需要偏离该文档，必须先在对应 plan 或 architecture 文档里写清楚原因、影响和替代方案，再开始改代码。

## 日志规范

日志必须可检索、可过滤、可定位。所有 runtime、tool、provider、permission、context、memory、UI 关键日志都使用统一前缀：

```text
HH:mm:ss sss[groupName][eventName] message
```

示例：

```text
10:33:06 602[agentLoop][turnStarted] threadId=... branchId=...
10:33:06 710[agentLoop][stopReason] reason=assistant_done iterations=2
10:33:06 811[provider][requestStarted] provider=openai model=...
10:33:06 920[tool][executionFinished] tool=echo_tool status=success
10:33:07 031[permission][decision] decision=allow source=default
10:33:07 142[context][built] sections=4 tokenEstimate=1234
10:33:07 253[memory][selected] count=2 scope=project
```

命名规则：

- `groupName` 使用 lower camel case，例如 `agentLoop`、`provider`、`tool`、`permission`、`context`、`memory`、`session`、`ui`。
- `groupName` 必须用于区分阶段，不要使用 `demo`、`app`、`misc` 这类无法定位运行阶段的名称。
- `eventName` 使用 lower camel case，例如 `turnStarted`、`requestStarted`、`executionFinished`。
- prefix 后的 message 优先使用 `key=value`，方便搜索和后续结构化解析。
- 同一类事件的 key 名要稳定，不要每次换写法。
- 禁止把 API key、token、credential、secret 原文写入日志。
- tool output 和 provider response 只记录摘要、长度、引用 ID，不默认记录完整内容。
- error log 必须包含可定位信息，例如 `threadId`、`branchId`、`toolCallId`、`agentId` 中的相关字段。
- 需要用户可见的事件，优先通过 `AgentEvent` 记录；log 用于调试和检索，不替代 session event。

## 每轮交付格式

开发完成后的说明建议使用：

```md
本轮完成：
- ...

关键设计：
- ...

代码讲解：
- ...

验证：
- ...

下一步建议：
- ...
```

如果没有运行测试，必须明确说明原因。

## 当前阶段的架构判断

Floris AI 不应该一开始追求复杂 agent framework。更好的路线是：

1. 先做清楚的 chat + agent loop + tool registry。
2. 再做 session persistence、branch tree 和 context builder。
3. 然后做 Context Inspector、conversation trimming、compaction 和 memory store。
4. 再完善显式 multi-agent、handoff、extension。
5. 最后评估是否需要基于可见 branch 的 agent 协作。

这样可以让每一步都能运行、能讲清楚、能测试，也方便人和 agent 一起持续改进。

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
