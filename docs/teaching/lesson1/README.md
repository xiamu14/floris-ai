# Lesson 1: MVP Agent Loop 教学规划

## 目标

Lesson 1 要实现一个能跑通的 TypeScript agent runtime MVP。它不追求完整产品能力，但要把 agent loop 的主干打通：

- 接收一条 user message。
- 构建最小 context。
- 调用 `ModelProvider`。
- 处理模型流式事件。
- 执行 `echo_tool`。
- 把 tool result 放回下一轮模型请求。
- 在明确条件下停止。
- 记录可回放的 agent events。

当前代码 tag 覆盖 Lesson 1.1 到 Lesson 1.3 的学习目标：runtime skeleton、ModelProvider / provider boundary、ToolRegistry / first tool。它还额外提供了一个最小 agent-loop debug demo，用来观察真实 AI API 的 user message、provider call、tool call、tool result 回填、token usage 和 stop reason。

这个 tag 不代表 Lesson 1.4 之后的能力已经完成。session、context window、hooks、permission、memory 等基础能力会在后续 tag 继续增强。

当前学习 tag：

```text
lesson1-agent-loop-basic-debug
```

学习覆盖：

| 小节 | 对应 tag | 学习结论 |
| --- | --- | --- |
| Lesson 1.1 Runtime skeleton | `lesson1-agent-loop-basic-debug` | package、目录、类型管理、测试工具链已经足够支撑后续实现。 |
| Lesson 1.2 ModelProvider boundary | `lesson1-agent-loop-basic-debug` | provider contract、OpenAI-compatible provider、MIMO config、role resolver 已形成最小边界。 |
| Lesson 1.3 ToolRegistry | `lesson1-agent-loop-basic-debug` | `echo_tool` 和 registry 已经足够解释 tool call 到 tool result 的回填路径。 |
| Lesson 1.4+ | 后续 tag | HookRunner、context window、session persistence、permission、memory 继续补。 |

完成整课后，开发者应该能独立解释并实现一个最小 code agent loop，理解为什么 agent loop 不是普通 chat completion，而是一个带 tools、hooks、context、event log 的状态机。

## 非目标

Lesson 1 不做这些深水区：

- 不实现完整多 provider 体系；当前只接入 OpenAI-compatible 的最小 adapter，用于 MIMO 这类兼容平台验证调用边界。
- 不实现完整权限审核 agent。
- 不实现真实 SQLite / SwiftData persistence。
- 不实现 JSONL persistence，只做 in-memory session store。
- 不实现真实权限策略，只做 no-op permission gate 或接口占位。
- 不实现 SwiftUI。
- 不实现完整 branch tree。
- 不实现真实 compaction。
- 不实现用户脚本 hooks。
- 不实现长期 memory 检索。

当前 tag 的非目标还包括：

- 不算完成 context window 或 Context Inspector。
- 不算完成 session persistence 或 branch tree。
- 不算完成 HookRunner。
- 不算完成 PermissionGate。
- 不算完成 MemoryStore。
- 不算完成 file / shell / git tools。

这些能力会在后续 lesson 中逐步补齐。Lesson 1 只保留接口和最小 stub，避免第一步过大。

Lesson 1 之后的课程方向见 ../../plans/lesson-roadmap.md。当前只有 Lesson 1 已展开成完整计划；Permission Request 不在 Lesson 1 实现范围内，后续会作为 Coding Agent Core 的 runtime protocol 和 Product Shell/UI 的 approval experience 分阶段实现。

## 参考资料

- Floris AI Agent Loop 实现范式: ../../architecture/agent-loop-implementation-paradigm.md
- Amp: How to Build an Agent: https://ampcode.com/notes/how-to-build-an-agent
- Amp: Agents for the Agent: https://ampcode.com/notes/agents-for-the-agent
- Amp: Context Management: https://ampcode.com/guides/context-management
- Amp Oracle: https://ampcode.com/news/oracle
- Amp GPT-5 Oracle: https://ampcode.com/news/gpt-5-oracle
- Amp Code System Prompt 2025-10-25: https://gist.github.com/gregce/9ae20efc085d45b36f1ce7a6a2b48845
- Pi session format: https://pi.dev/docs/latest/session
- Pi compaction: https://pi.dev/docs/latest/compaction
- Claude Code hooks: https://docs.claude.com/en/docs/claude-code/hooks
- Claude Code hooks newer reference: https://code.claude.com/docs/en/hooks
- Anthropic stop reasons: https://docs.anthropic.com/en/api/handling-stop-reasons
- OpenAI function calling overview: https://help.openai.com/en/articles/8555517-function-calling-in-the-openai-api

## AI Agent 架构演进脉络

Lesson 1 需要把 agent loop 放在更大的架构演进里理解。

### 阶段一：Prompt 驱动

最早的 AI coding experience 主要是 prompt engineering：写清楚角色、约束、输出格式，然后模型直接回答。这个阶段的问题是：

- 无法可靠读写项目文件。
- 无法确认真实环境状态。
- 无法自动运行验证命令。
- 长上下文容易失控。
- prompt 越写越大，维护困难。

### 阶段二：Tool Calling

模型开始通过结构化 tool call 请求外部能力。agent 不再只是回答文本，而是可以请求：

- 读文件。
- 搜索代码。
- 运行命令。
- 修改文件。
- 查询文档。

但 tool calling 只是能力入口，还不是完整 agent。关键问题变成：谁负责循环？谁负责终止？谁记录过程？谁做权限判断？

### 阶段三：Agent Loop

Agent loop 把 tool calling 变成可运行状态机：

```text
model asks for tool
  -> runtime executes tool
  -> runtime sends result back
  -> model continues
  -> runtime decides when to stop
```

Lesson 1 就是实现这个阶段的最小闭环。

### 阶段四：Context Engineering

当任务变长，核心问题从“怎么调用工具”变成“给模型什么上下文”。这也是 OpenViking、Skills、RAG、Memory 文章共同指向的方向。

Floris AI 后续会引入：

- Context Inspector。
- conversation trimming。
- memory library。
- branch context。
- per-agent context policy。

### 阶段五：Specialized Agents

当不同任务需要不同模型和能力时，系统从单 agent 走向显式 multi-agent：

- `@coder` 负责日常实现。
- `@oracle` 负责复杂分析和 review。
- `@explorer` 负责搜索和架构定位。
- `@reviewer` 负责检查 diff 和风险。

Lesson 1 不实现 multi-agent，但 `AgentProfile` 必须从第一天存在，因为它是后续演进的入口。

### 阶段六：Observable Runtime

生产级 agent 必须能解释自己做了什么。event log、context snapshot、hook result、permission decision 都是可观测 runtime 的基础。

Lesson 1 的 event log 是这个方向的最小起点。

## Lesson 1 在整个演进中的位置

Lesson 1 是 Floris AI 从 0 到 1 的第一块地基。它要故意小，但不能是一次性 demo。

它必须保留这些未来接口：

- `AgentProfile`：为 multi-agent 留入口。
- `ModelProvider`：为多 provider 留入口。
- `OpenAICompatibleModelProvider`：为真实 OpenAI-compatible 请求、日志和 token usage 观察留入口。
- `ToolRegistry`：为不同 agent 的 tool scope 留入口。
- `HookRunner`：为权限、安全、context 注入、stop 检查留入口。
- `ContextBuilder`：为 Context Inspector 留入口。
- `SessionStore`：为 branch tree 和 replay 留入口。
- `PermissionGate`：为 `PolicyReviewer` 留入口。

这就是 Lesson 1 的判断标准：**不是功能多，而是每个关键边界都在正确位置。**

## 参考方案对比

### Amp

Amp 对 agent 的最小定义很清楚：LLM + system prompt + tools。agent loop 的基础流程是：

1. 把 user message 和已有 context 发给 model。
2. 如果 model 要 tool，就执行 tool。
3. 把 tool result 加回 context。
4. 再请求 model。
5. 如果 model 不再请求 tool，就结束本轮。

Lesson 1 采用这个主循环，因为它简单、可测试、容易解释。

Amp Oracle 给我们的启发是：不是所有请求都该用同一个模型。日常编码用主 agent，复杂分析或 review 才用更强模型。Lesson 1 只实现 provider 抽象，不实现真实多模型调度，但类型上要为 `AgentProfile.defaultModelId` 和不同 provider 留位置。

### Pi

Pi 的关键启发是 session 是可恢复的事件记录，不只是最终消息列表。Pi session 使用 JSONL，并通过 `id` / `parentId` 支持树状结构。这对 Floris AI 的 branch 设计很重要。

Lesson 1 不做完整 branch tree，但 event 结构要避免只能表达线性消息。最小实现里每个 event 要有：

- `id`
- `type`
- `threadId`
- `branchId`
- `parentId`
- `createdAt`

这样后续扩展到 branch tree 时，不需要推翻 Lesson 1 的 event log。

### Claude Code

Claude Code hooks 给了我们两个重要设计点：

- `PreToolUse` 可以在 tool 执行前拦截或请求权限。
- `Stop` 可以阻止 agent 过早结束，让 agent 继续完成检查、总结或修复。

Lesson 1 采用内部 typed hooks，不做用户脚本。原因是第一阶段我们先保证 runtime 语义稳定，后续开放 extension 或脚本时，再基于 hook 文档扩展。

### Anthropic / OpenAI API

Anthropic Messages API 有明确的 `stop_reason`，例如 `tool_use`、`end_turn`、`max_tokens`。OpenAI function calling / Responses API 会通过结构化 tool call 表示模型需要外部工具。

不同 provider 的 API shape 不一样，但 agent loop 不应该直接依赖 provider 原始返回。Lesson 1 要定义 Floris AI 内部统一事件：

- `text_delta`
- `tool_call_done`
- `usage`
- `done`
- `error`

后续任何 provider adapter 都要转成这套事件。

## Lesson 1 的 7 个小节

开始写代码前，必须先读 `docs/architecture/agent-loop-implementation-paradigm.md`。Lesson 1 的 agent loop 实现要遵守其中的 data-driven、event-driven、interface boundary 约定。

小节索引：

- `Lesson 1.1`：Runtime skeleton, package layout, and baseline tooling。
- `Lesson 1.2`：ModelProvider, prompt contracts, and provider transport boundary。
- `Lesson 1.3`：ToolRegistry and first tool。
- `Lesson 1.4`：HookRunner MVP。
- `Lesson 1.5`：Context, prompt, memory, session, and permission stubs。
- `Lesson 1.6`：AgentLoop MVP state machine and stop reasons。
- `Lesson 1.7`：CLI demo, verification, teaching notes, and implementation breakdown。

### Lesson 1.1 Runtime 目录结构和基础工具链

目标：

- 创建 `packages/agent-runtime` package。
- 建立 runtime 源码目录、测试目录和 `src/types` 类型目录。
- 配置 Bun、TypeScript、Vitest、Ultracite + Biome、Zed formatter。
- 明确类型集中管理规则，但不在 1.1 集中定义所有业务类型。

建议目录：

```text
packages/agent-runtime/
  src/
    core/
      agent-loop.ts
      agent-events.ts
      agent-profile.ts
      loop-stop-reason.ts
    providers/
      model-provider.ts
      openai-compatible-provider.ts
      openai-compatible-provider-factory.ts
      provider-resolver.ts
    tools/
      tool.ts
      tool-registry.ts
    hooks/
      hook.ts
      hook-runner.ts
    context/
      context-builder.ts
    memory/
      memory-store.ts
    session/
      session-store.ts
    permissions/
      permission-gate.ts
    prompts/
      default-agent-role-prompts.ts
    types/
      agent.type.ts
      context.type.ts
      hook.type.ts
      memory.type.ts
      message.type.ts
      permission.type.ts
      prompt.type.ts
      provider.type.ts
      runtime.type.ts
      session.type.ts
      tool.type.ts
    index.ts
  tests/
    agent-loop.test.ts
```

类型管理规则：

- `src/types/*.type.ts` 是唯一的命名类型定义位置。
- 基础类型不作为独立小节一次写完。
- 每个功能小节开始时，先补齐自己需要的 contract 类型。
- `Lesson 1.2` 补 provider、prompt、agent profile 类型，`Lesson 1.3` 补 tool 类型，`Lesson 1.4` 补 hook 类型，`Lesson 1.5` 补 context / memory / session / permission 类型，`Lesson 1.6` 补 loop 状态和 stop reason 类型。
- 实现文件只 `import type`，不在业务代码里顺手定义可复用类型。

测试要求：

- `bun run typecheck` 通过。
- `bun run test` 可以运行 placeholder tests。
- `bun run check` 通过。
- 目录结构能支撑后续小节继续实现，不需要把 TS tooling 放回 root。

### Lesson 1.2 ModelProvider 和 Prompt 最小接口

目标：

- 抽象出 provider，避免 agent loop 绑定某个 SDK。
- 实现 OpenAI-compatible provider adapter，让 demo 直接观察真实 AI API 的 token usage。
- 在 `provider.type.ts` 补齐本小节需要的 `ModelProvider`、`ModelRequest`、`ModelEvent` 类型。
- 在 `prompt.type.ts` 补齐 `PromptTemplate`、`SystemPromptRef`、`PromptStore` 类型。
- 在 `agent.type.ts` 明确 `AgentProfile.systemPrompt` 和 `AgentRoleDefinition.systemPrompt`，不要继续用 `instructions: string[]` 混放 role prompt。
- 基于 Amp Code system prompt 建立 Floris AI 默认 prompt。能直接对应 Floris AI 的内容直接使用；Amp 专属品牌、工具名、tool schema、Amp 官网说明等不对应内容改写成 Floris AI runtime 语义。
- 定义 `agent.config.ts` 如何提供 `apiUrl`、model mapping 和 role fallback。

设计模式选择：

- `ModelProvider` 使用 Strategy。`AgentLoop` 只依赖这个接口，不关心 Anthropic、OpenAI 或本地模型。
- 真实 provider 接入时使用 Adapter。不同 SDK 的 request、response、stop reason、tool call shape 都转成 Floris AI 内部 `ModelRequest` / `ModelEvent`。
- Agent Loop 运行过程默认通过 MLflow trace 观察。console 只输出最终 demo summary 和必要错误。
- `ModelEvent` stream 使用 `AsyncIterable`。Provider 可以流式输出文本、tool call、usage 和 done event。
- 模型返回的 tool call 按 Command 思路处理：provider 只产出 `{ id, name, input }`，执行交给 `ToolRegistry`。

暂时不采用：

- 不使用继承式 `BaseProvider`。Provider 差异用 adapter 和 plain object contract 表达，避免后续真实 provider 被父类模板限制。
- 不使用 Abstract Factory。Lesson 1 只有一个 OpenAI-compatible provider factory，还不需要 provider registry。
- 不提供替代真实模型调用的 demo 路径。学习本项目时要求使用真实 AI API 平台，因为 token usage 是核心观察目标。

建议接口：

```ts
interface ModelProvider {
  id: string;
  createMessage(
    request: ModelRequest,
    signal: AbortSignal
  ): AsyncIterable<ModelEvent>;
}
```

真实 provider adapter 走这条 path：

```text
AgentLoop
  -> ModelProvider
      -> OpenAICompatibleModelProvider
          -> OpenAI SDK compatible client
```

`AgentRole` 到 provider 的解析不能写进 agent loop。推荐在 provider 创建前做一层 resolver：

```text
requested AgentRole
  -> config.agents[role]
  -> config.models[modelRef]
  -> config.providers[providerId]
  -> ModelProvider
```

`agent.config.ts` 最小形状：

```ts
export default defineAgentConfig({
  defaultRole: "coder",
  providers: {
    openai: {
      kind: "openai",
      apiUrl: "https://api.openai.com/v1",
      apiKeyEnvName: "OPENAI_API_KEY",
    },
  },
  prompts: {
    coderSystem: {
      id: "agent.coder.system",
      kind: "system",
      version: "1",
    },
  },
  models: {
    fast: { providerId: "openai", modelId: "gpt-4.1-mini" },
  },
  agents: {
    coder: {
      role: "coder",
      systemPromptRef: "coderSystem",
      modelRef: "fast",
      fallbackModelRefs: [],
    },
  },
});
```

关键边界：

- `AgentRole` 不等于 provider。`coder`、`oracle`、`reviewer`、`explorer` 只是 agent role，不应该直接决定 SDK。
- `apiUrl` 从 `providers[providerId]` 读取，不放进 `AgentProfile`。
- `modelId` 从 `models[modelRef]` 读取，不在 agent loop 里硬编码。
- `systemPrompt` 从 `agents[role].systemPromptRef` 读取，不在 agent loop 或 provider 里硬编码。
- 多个 role 可以共用一个 provider 和 model。
- 未配置的 role fallback 到 `defaultRole`。
- role 的主 model 缺失或 provider 不可用时，按 `fallbackModelRefs` 依次尝试。
- 所有 fallback 都要记录原因和最终选择的 provider/model，方便 UI 和 event log 展示。
- 所有真实 provider 都不可用时，返回 typed configuration error。产品运行时不能自动切到替代 provider。

Lesson 1 的 `ModelEvent`：

- `text_delta`
- `tool_call_done`
- `usage`
- `done`
- `error`

OpenAI-compatible provider 当前使用非 streaming Chat Completions。后续如果接入 streaming，再在 provider adapter 内部把 streaming tool input delta 组装成统一的 `tool_call_done` event，agent loop 不直接处理 provider 原始 delta。

Provider 不负责：

- tool 执行。
- permission decision。
- hook lifecycle。
- session 写入。
- API key 存储。
- AgentRole fallback。

Prompt 管理最小规则：

- `system prompt` 是 agent role 的核心 contract，必须通过 `AgentProfile.systemPrompt` 明确引用。
- 默认 role prompt 放在 `src/prompts/default-agent-role-prompts.ts`，先覆盖 `coder`、`oracle`、`reviewer`、`explorer`。
- `PromptTemplate` 必须有 `id`、`kind`、`version`、`title`、`content`、`variables`。
- ContextBuilder 后续只读取 prompt ref 解析后的 prompt，不直接硬编码 role prompt。

默认 prompt 映射规则：

- Amp 的 `Agency`、`Conventions & Rules`、`AGENTS.md file`、`Context`、`Communication` 是 shared agent principles，进入所有默认 role prompt。
- Amp 的 `Task Management` 进入 `coder` prompt，因为 Lesson 1 的默认执行 agent 承担任务推进和状态更新。
- Amp 的 `Oracle` 进入 `oracle` prompt，但改成 Floris AI 的显式 `@oracle` / visible handoff 语义，不写成隐藏后台工具。
- `reviewer` 和 `explorer` 使用 shared principles，并增加 Floris AI 的 read-only review / exploration role 约束。
- Amp 里与具体工具实现绑定的内容，例如 `todo_write`、`finder`、`Read`、`edit_file`、tool JSON schema、Amp Thread URL、查询 Amp 官网等，不直接写入 Floris AI 默认 prompt。对应能力后续通过 tool registry、hook、UI 和 docs 表达。
- 默认 prompt 不能把 Floris AI 产品永久限定为 coding agent。coding 只写在 `coder` role 中，shared prompt 只说明运行在 Floris AI agent runtime 内。

API key 存储：

- 当前 OpenAI-compatible / MIMO path 使用 env 读取 API key，用于验证 provider 调用边界和 token usage。
- 后续产品形态应使用平台无关的本地加密配置。
- runtime 不直接依赖 macOS Keychain。
- 将来可以做 `SecretStore` adapter，让 macOS 用 Keychain，其他平台用别的 backend。

测试要求：

- `AgentProfile` fixture 必须显式引用 system prompt。
- 默认 agent role prompts 覆盖 `coder`、`oracle`、`reviewer`、`explorer`。
- 默认 prompt 内容必须包含 Amp 映射后的 shared sections，并保持 role-specific boundaries。
- 支持用户中断：`AbortSignal` abort 后停止输出。
- 可以模拟 provider error。
- `coder` role 能解析到配置里的 provider 和 model。
- 未配置 role 时 fallback 到 `defaultRole`。
- model 或 provider 缺失时返回可展示的配置错误，不让 agent loop crash。

### Lesson 1.3 ToolRegistry 最小实现

目标：

- 定义 tool 抽象。
- 让 agent loop 通过 registry 执行 tool，而不是直接 import 某个函数。

建议接口：

```ts
interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
  execute(input: unknown, context: ToolExecutionContext): Promise<ToolResult>;
}
```

Lesson 1 内置一个最小 tool：

- `echo_tool`：返回传入参数。

如果想更贴近 code agent，可以用：

- `read_project_file`：从测试 fixture workspace 读一个文件。

但第一课推荐先用 `echo_tool`，减少 filesystem 变量。

### Lesson 1.3.x Structured Trace and Visual Observation

状态：implemented with local MLflow demo

目标：

- 在继续补真实 tools 前，先把 Agent Loop 运行过程从 console debug log 升级为 structured trace。
- 让多轮 tool call、provider events、tool output filtering、token metrics、stop reason 能被查询和可视化。
- 为后续 benchmark 提供同一份运行 artifact，避免 benchmark 只断言最终文本。

设计方向：

- `AgentEvent` 继续服务产品/session 历史。
- `TraceSpan` / `TraceEvent` 服务开发观察、教学演示和 benchmark 复盘。
- 第一版 trace 写 JSONL，默认在本地 `.floris-traces/` 目录保存。
- trace 通过 `runId`、`threadId`、`branchId`、`iteration`、`toolCallId` 关联 agent loop、provider 和 tool。
- trace 记录 duration、usage、tool metrics、rawRef、reduction ratio、stop reason，但不保存 secret 原文。
- 当前实现优先接 MLflow，不先做 JSONL viewer。JSONL 仍保留为后续 benchmark artifact 方向。

可视化策略：

- 优先接入 MLflow Tracing。Floris 内部 trace contract 不直接依赖 MLflow，而是通过 `MlflowTraceRecorder` adapter 映射。
- 当前不引入 OpenTelemetry 设计，直接使用 `mlflow-tracing` TypeScript SDK。
- 如果 MLflow 本地启动、数据映射或实时观察成本不适合 Lesson 1.3，就先做简易 web trace flow。
- 简易 viewer 读取同一份 JSONL trace，展示 run list、span tree / timeline、selected span details、tool output、token metrics 和 event sequence。

本地运行：

```bash
docker compose up -d mlflow
cd packages/agent-runtime
MLFLOW_TRACKING_URI=http://127.0.0.1:5001 MLFLOW_EXPERIMENT_ID=0 bun run demo --example echo
```

详细说明见 `docs/architecture/mlflow-tracing.md`。

PromptManager / AgentVersion 和 MLflow Prompt Registry / Agent versions 的关系见 `docs/architecture/mlflow-prompt-and-agent-versioning.md`。结论是 Floris 本地 typed contract 仍是 source of truth，MLflow 用作 registry mirror、trace lineage 和 eval UI。

benchmark 策略：

- 第一批 benchmark 用 scripted provider 跑真实 AgentLoop，不依赖真实模型和网络。
- 每个 benchmark case 输出 trace JSONL。
- 断言 stop reason、event sequence、tool call sequence、usage、output filtering metrics、trace parseability。
- 真实 provider smoke eval 后续单独加，必须通过 env 显式开启。

测试要求：

- 已注册 tool 可以执行并返回 result。
- 未知 tool 返回可恢复错误，不直接 crash。
- tool error 会被写入 agent event。
- trace JSONL 可以 parse。
- 多轮 tool call 的 trace span parent/child 关系可以断言。
- MLflow / OpenTelemetry exporter 可以用 mock 测试，不要求本地必须启动 MLflow。

### Lesson 1.4 HookRunner MVP

目标：

- 建立内部 typed hooks。
- 让 context、tool、stop、interrupt 都有扩展点。
- 未来开放 extension 时有稳定依据。

Lesson 1 hook events：

- `SessionStart`
- `BeforeContextBuild`
- `AfterContextBuild`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `UserInterrupt`

Hook 设计原则：

- Hook 输入输出必须 typed，本小节类型写入 `hook.type.ts`。
- Hook 执行顺序必须稳定。
- Hook 结果必须写入 event log。
- `PreToolUse` 可以阻止 tool 执行。
- `Stop` 可以要求继续一轮。
- `UserInterrupt` 只做清理和记录，不应该阻止中断。

暂时不做：

- 用户脚本。
- shell hook。
- HTTP hook。
- prompt-based hook。
- agent hook。

这些可以后续开放，但必须基于本 lesson 的 hook 语义文档。

测试要求：

- hook 调用顺序可断言。
- `PreToolUse` 阻止 tool 后，tool 不执行。
- `Stop` 返回 continue 后，loop 再跑一轮或返回 `stop_blocked` stub。
- `UserInterrupt` hook 被调用，但不会阻止 abort。

### Lesson 1.5 Context, prompt, memory, session, and permission stubs

目标：

- 让 agent loop 不直接拼字符串。
- 建立 `ContextBuilder`。
- 从 `AgentProfile.systemPrompt` 解析 system prompt，并作为独立 context section。
- 读取 `AGENTS.md` 作为 project instructions。
- 接入内存版 `MemoryStore`、`SessionStore` 和 no-op `PermissionGate`。

Lesson 1 的 context sections：

- `system`: agent role system prompt + runtime instruction。
- `project_instructions`: `AGENTS.md` 摘要或全文 MVP。
- `recent_messages`: 当前 branch 最近消息。
- `memory`: 手动放入的 memory entries。
- `tool_results`: 本轮 tool result。

类型归属：

- `context.type.ts`：`ContextSection`、`ContextBuildInput`、token estimate。
- `memory.type.ts`：`MemoryEntry`、`MemoryStore`。
- `session.type.ts`：`AgentEvent`、`SessionStore`。
- `permission.type.ts`：`PermissionGate`、permission decision stub。
- `prompt.type.ts`：本小节使用 `PromptStore` 解析 `SystemPromptRef`。

MVP 可以先用粗略 token estimate：

- 字符数 / 4。
- 后续再换 provider tokenizer 或模型专用 estimator。

测试要求：

- `ContextBuilder` 输出 section 列表。
- `ContextBuilder` 输出独立 `system` section，内容来自解析后的 `AgentProfile.systemPrompt`。
- 可以包含 `AGENTS.md`。
- 可以按最大 section 数裁剪 recent messages。
- token estimate 有稳定结果。
- session event 可以 JSON serialize / parse。
- no-op permission gate 出现在 tool path 中，但不阻止 demo tool。

### Lesson 1.6 AgentLoop MVP

目标：

- 实现 `runTurn()`。
- 支持模型请求、tool 执行、tool result 回传、停止。
- 在 `runtime.type.ts` 补齐 loop 状态、run turn input / result 和 stop reason 类型。

核心状态机：

```text
start
  -> build context
  -> provider request
  -> consume model events
  -> if tool call: execute tool, append tool result, continue
  -> if done without tool call: stop
  -> if abort/error/limit: stop with reason
```

Lesson 1 停止条件：

- `assistant_done`：模型完成且没有待执行 tool。
- `tool_use`：中间状态，不是最终停止，用于记录模型请求了 tool。
- `max_iterations`：超过最大循环次数。
- `provider_error`：provider 出错。
- `user_interrupted`：用户中断。
- `tool_error`：tool 执行失败且不可恢复。

关于“何时终止”的教学重点：

- 没有 tool call 不代表任务质量一定好，只代表模型说本轮结束。
- `Stop` hook 可以检查“是否应该真的停”。
- 完整 MVP 应让 `Stop` hook 有能力阻止停止，但当前 tag 还没有接入 HookRunner。
- 必须有 `max_iterations`，防止模型不断请求 tool。

测试要求：

- provider 只返回 text，loop 以 `assistant_done` 结束。
- provider 先返回 tool call，再返回 text，loop 正常结束。
- provider 连续请求 tool，达到 `max_iterations` 后先做一次 no-tool final synthesis。
- provider 返回 `max_tokens` 且没有 tool call 时，loop 返回 `provider_max_tokens`。
- 默认 output budget 面向通用 code agent：普通 provider request 使用 `4096`，final synthesis request 覆盖到 `8192`。
- 默认 tool context budget 使用 `1600`；`read_file` 超预算时保留源码 excerpt，不降级成纯 summary。
- abort 后停止，reason 是 `user_interrupted`。

### Lesson 1.7 Demo, verification, and documentation sync

目标：

- 提供一个 CLI demo，证明 runtime 能跑。
- 当前 demo 默认写入 MLflow trace，用于观察 agent loop、provider、tool 和 token usage。
- 写出教学笔记和实现拆解。
- 总结哪些地方是 MVP 简化版。

Demo 流程：

```text
user: please echo hello
provider: requests echo_tool({ text: "hello" })
tool: returns { text: "hello" }
provider: final answer "tool returned hello"
loop: stops with assistant_done
```

测试要求：

- 一条命令可以跑完整 demo。
- 单元测试覆盖主路径。
- event log 能看到 user message、provider event、tool call、tool result、stop reason。

## Lesson 1 输出物

Lesson 1 完成时必须有：

- `packages/agent-runtime` 最小代码。
- 单元测试。
- CLI demo。
- `docs/teaching/lesson1/notes.md` 教学笔记。
- `docs/teaching/lesson1/implementation-breakdown.md` 基于真实代码和运行结果的实现拆解。
- `docs/plans/lesson1-mvp-agent-loop.md` 实现计划更新为已完成状态。

## 教学笔记要求

教学笔记不是简单总结，要让用户能独立实现这一课。每个小节至少包含：

- 本小节目标。
- 核心类型和函数。
- 关键代码路径。
- 为什么这么设计。
- 替代方案和暂时不采用的原因。
- 测试怎么写。
- 常见错误。

## 实现拆解要求

实现拆解必须基于真实代码和真实运行结果。它应该回答：

- 实际新增了哪些文件。
- 每个核心文件负责什么。
- agent loop 的执行路径是什么。
- demo 输出说明了什么。
- 测试覆盖了什么。
- 哪些地方还是 MVP 简化版。
- 下一课要如何继续扩展。

## Lesson 1 验收标准

- `packages/agent-runtime` 可以在命令行跑 demo。
- `bun run demo` 可以通过真实 OpenAI-compatible provider 输出 token usage。
- agent loop 有明确 stop reason。
- hook runner 至少覆盖 context、tool、stop、interrupt。
- context builder 能读取 `AGENTS.md`。
- 所有主路径有单元测试。
- 文档足够完整，开发者可以按文档独立重写一版 MVP。
