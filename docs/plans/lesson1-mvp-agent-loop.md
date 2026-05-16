# Lesson 1 MVP Agent Loop 实现计划

## 状态

当前状态：in progress

当前代码 tag 覆盖 Lesson 1.1 到 Lesson 1.3 的学习目标，并额外提供最小 agent-loop demo 和 MLflow trace。它不代表 Lesson 1.4 之后的 session、context window、permission、memory、Web UI、hooks 等能力已经完成。

当前学习 tag：

```text
lesson1-agent-loop-basic-debug
```

小节和 tag 对应关系：

| 小节 | 对应 tag | 状态 |
| --- | --- | --- |
| Lesson 1.1 Runtime skeleton | `lesson1-agent-loop-basic-debug` | learning complete |
| Lesson 1.2 ModelProvider boundary | `lesson1-agent-loop-basic-debug` | learning complete |
| Lesson 1.3 ToolRegistry and first tool | `lesson1-agent-loop-basic-debug` | learning complete |
| Lesson 1.4 Context / memory / session / permission | 后续 tag | not implemented as capability |
| Lesson 1.5 AgentLoop state machine | 后续 tag | partial, only basic call path used by demo |
| Lesson 1.6 Stream Rendering Web UI | 后续 tag | not implemented |
| Lesson 1.7 HookRunner MVP | 后续 tag | not implemented |

本计划对应教学规划：

- `docs/teaching/lesson1/README.md`
- `docs/architecture/agent-loop-implementation-paradigm.md`
- `docs/teaching/lesson1/tool-architecture.md`
- `docs/plans/lesson-roadmap.md`

## 实现目标

完整 Lesson 1 目标是实现一个 TypeScript `agent-runtime` MVP。它能通过正式 `ModelProvider` path 和真实 AI API provider 跑通一次 agent turn：

1. 接收 user message。
2. 构建 context。
3. 调用 provider。
4. 收到 tool call。
5. 执行 tool。
6. 把 tool result 加回 context。
7. 再调用 provider。
8. 收到 final answer。
9. 以明确 stop reason 结束。
10. 输出 event log。

## 实现边界

Lesson 1 完整计划范围：

- TypeScript runtime package。
- ModelProvider + OpenAI-compatible provider adapter。
- Prompt contracts + default agent role system prompts。
- Tool registry。
- Agent loop MVP。
- 内部 typed hooks。
- Context builder MVP。
- Memory store MVP。
- In-memory session store。
- No-op permission gate 或接口占位。
- Stream rendering Web UI。
- 单元测试。

当前已实现的 Lesson 1.1 到 Lesson 1.3 学习内容：

- `ModelProvider` path、OpenAI-compatible provider adapter。
- `echo_tool` 和 tool result 回填。
- workspace tools MVP：`list_files`、`read_file`、`search_files`。
- runtime tools MVP：`git_status`、`http_request`、`run_command`。
- MIMO config、env API key 读取、role/provider/model resolver。
- runtime package、类型目录、测试、check、demo 脚本。

当前 tag 额外提供的观察能力：

- `AgentLoop.runTurn()` 的基本调用路径。
- demo 默认写入 MLflow trace，用于观察 provider request、provider event、tool result、duration 和 token usage。

当前未实现的 Lesson 1 能力：

- HookRunner pipeline。
- Context window / Context Inspector。
- session persistence / branch tree。
- MemoryStore。
- PermissionGate。
- `apply_patch`、`git_diff`、long-running command tools、task tools。

Lesson 1 完整计划不实现：

- 完整多 provider 体系。
- SwiftUI。
- 真实权限审核 agent。
- Permission Request / user approval flow。
- SQLite / SwiftData。
- JSONL persistence。
- 真实权限策略。
- 完整 branch UI。
- 完整 compaction。
- 用户脚本 hooks。
- 长期 memory 检索。

## 建议文件结构

```text
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
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      index.ts
      core/
        agent-loop.ts
        agent-events.ts
        agent-profile.ts
        loop-stop-reason.ts
        messages.ts
      providers/
        model-provider.ts
        openai-compatible-provider.ts
        openai-compatible-provider-factory.ts
        provider-resolver.ts
      tools/
        tool.ts
        tool-registry.ts
        echo-tool.ts
      hooks/
        hook.ts
        hook-runner.ts
      context/
        context-builder.ts
        context-section.ts
      memory/
        memory-store.ts
      session/
        session-store.ts
        in-memory-session-store.ts
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
      demo/
        run-demo.ts
    tests/
      tool-registry.test.ts
      hook-runner.test.ts
      context-builder.test.ts
      agent-loop.test.ts
```

## 小节计划

Lesson 1 固定为 7 个小节。README、plan、notes、implementation breakdown 都使用同一套小节编号。

### Lesson 1.1 Runtime skeleton, package layout, and baseline tooling

状态：learning complete in `lesson1-agent-loop-basic-debug`

目标：

- 建立 `apps/mac-desktop` app shell。
- 建立 `packages/agent-runtime` package。
- 配置 Bun、TypeScript、Vitest、Ultracite + Biome、Zed formatter。
- 建立 runtime 源码、测试和类型目录。

任务：

- 创建 `packages/agent-runtime/package.json`。
- 配置 `tsconfig.json`、`vitest.config.ts`、`biome.jsonc`。
- 创建 `src/core`、`src/providers`、`src/tools`、`src/hooks`、`src/context`、`src/memory`、`src/session`、`src/permissions`、`src/types`。
- 创建 placeholder smoke tests，避免空 test file 导致 Vitest 失败。

实际结果：

- 已创建 `apps/mac-desktop` app shell 和 `packages/agent-runtime` package。
- 已配置 TypeScript、Vitest、Ultracite + Biome、Zed Biome formatter。
- 已运行 `bun run typecheck`、`bun run test`、`bun run check`，均通过。

测试：

- `cd packages/agent-runtime && bun run typecheck`。
- `cd packages/agent-runtime && bun run test`。
- `cd packages/agent-runtime && bun run check`。

### Lesson 1.2 ModelProvider, prompt contracts, and provider transport boundary

状态：learning complete in `lesson1-agent-loop-basic-debug`

目标：

- 定义 `ModelProvider`、`ModelRequest`、`ModelEvent`。
- 定义 `PromptTemplate`、`SystemPromptRef`、`PromptStore`。
- 定义 `AgentProfile.systemPrompt` 和 `AgentRoleDefinition.systemPrompt`。
- 基于 Amp Code system prompt 提供默认 `coder`、`oracle`、`reviewer`、`explorer` system prompt。
- 定义 `agent.config.ts` 里 provider、model、agent role 的最小配置形状。
- 定义 `AgentRole` 到 `ModelProvider` 的解析流程和 fallback 规则。
- 实现 OpenAI-compatible provider adapter，用 MIMO 这类平台验证真实调用。

设计模式选择：

- `ModelProvider` 使用 Strategy。`AgentLoop` 只依赖这个接口，不关心 Anthropic、OpenAI 或本地模型。
- 真实 provider 接入时使用 Adapter。不同 SDK 的 request、response、stop reason、tool call shape 都转成 Floris AI 内部 `ModelRequest` / `ModelEvent`。
- MLflow trace 用于观察真实 provider 请求、tool 调用和 token usage。临时 bug 调试可以单独加局部 debug wrapper。
- `ModelEvent` stream 使用 `AsyncIterable`。Provider 可以流式输出 `text_delta`、`tool_call_done`、`usage`、`done`、`error`，UI 和 session 后续都能逐步消费。
- 模型返回的 tool call 按 Command 思路处理：provider 只产出 `{ id, name, input }`，执行交给 `ToolRegistry`。

不采用：

- 不使用继承式 `BaseProvider` + subclass。Provider 差异用 adapter 和 plain object contract 表达，避免把 OpenAI / Anthropic / local model 的差异塞进父类模板。
- 不使用 Abstract Factory。Lesson 1 只有一个 OpenAI-compatible provider factory，还不需要 provider registry 或复杂创建逻辑。
- 不提供替代真实模型调用的 demo 路径。token usage 是项目核心观察对象，学习路径必须使用真实 AI API 平台。

推荐结构：

```text
AgentLoop
  -> ModelProvider
      -> OpenAICompatibleModelProvider
          -> OpenAI SDK client
```

配置读取：

Lesson 1 只做开发阶段 provider 配置选项，不做 desktop app 可视化配置层，也不把某个平台定义为产品默认配置。`agent.config.ts` 不应该保存 secret 原文，只保存 provider endpoint、model mapping、role mapping 和可引用的 env 名称。

当前阶段先提供 MIMO 这个 OpenAI-compatible 平台选项，后续可以并列加入 OpenAI 等其他平台选项：

- `MIMO_API_KEY`：必需，factory 从 env 读取。
- `MIMO_BASE_URL`：可选，未设置时使用 MIMO 平台地址 `https://api.xiaomimimo.com/v1`。
- 当前阶段选用模型：`mimo-v2.5-pro`。
- 当前阶段选用参数：`maxCompletionTokens: 4096`、`temperature: 1`、`topP: 0.95`、`frequencyPenalty: 0`、`presencePenalty: 0`、`stop: null`。
- `coder`、`oracle`、`reviewer`、`explorer` 在当前阶段都映射到同一个 MIMO model，避免某个 `AgentRole` 无法运行。

推荐最小形状：

```ts
export default defineAgentConfig({
  defaultRole: "coder",
  providers: {
    mimo: {
      kind: "openai",
      apiUrl: env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1",
      apiUrlEnvName: "MIMO_BASE_URL",
      apiKeyEnvName: "MIMO_API_KEY",
    },
  },
  prompts: {
    coderSystem: {
      id: "agent.coder.system",
      kind: "system",
      version: "1",
    },
    oracleSystem: {
      id: "agent.oracle.system",
      kind: "system",
      version: "1",
    },
  },
  models: {
    "mimo-v2.5-pro": {
      providerId: "mimo",
      modelId: "mimo-v2.5-pro",
      parameters: {
        maxCompletionTokens: 4096,
        temperature: 1,
        topP: 0.95,
        frequencyPenalty: 0,
        presencePenalty: 0,
        stop: null,
      },
    },
  },
  agents: {
    coder: {
      role: "coder",
      systemPromptRef: "coderSystem",
      modelRef: "mimo-v2.5-pro",
      fallbackModelRefs: [],
    },
    oracle: {
      role: "oracle",
      systemPromptRef: "oracleSystem",
      modelRef: "mimo-v2.5-pro",
      fallbackModelRefs: [],
    },
  },
});
```

解析流程：

```text
requested AgentRole
  -> find config.agents[role]
  -> if missing, use config.agents[defaultRole]
  -> resolve modelRef to config.models[modelRef]
  -> resolve providerId to config.providers[providerId]
  -> create ModelProvider with provider apiUrl + selected modelId
  -> if provider/model unavailable, try fallbackModelRefs in order
  -> if all fail, return typed configuration error
```

OpenAI-compatible provider 创建流程：

```text
ProviderFactoryInput
  -> createOpenAICompatibleProviderFromEnv()
  -> read MIMO_API_KEY from env when apiKeyEnvName is configured
  -> if missing, return provider unavailable to resolver
  -> pass explicit apiKey into OpenAICompatibleModelProvider
  -> OpenAICompatibleModelProvider creates OpenAI SDK client with apiUrl + apiKey
```

Factory 和 provider 的边界：

- env 读取只发生在 factory / config 层。
- `OpenAICompatibleModelProvider` 不读取 env，也不做 `getApiKey` fallback。
- `OpenAICompatibleModelProvider` 只接收显式 `apiKey` 或 injected OpenAI SDK compatible client。
- provider class 只负责调用 SDK、映射 request、映射 event。
- API key 不进入 `ModelRequest`、prompt、event payload 或 session log。

边界规则：

- `AgentRole` 不等于 provider。`coder`、`oracle`、`reviewer`、`explorer` 只是 agent 能力和默认 model policy。
- 多个 role 可以共用同一个 provider 和 model，也可以使用不同 provider。
- `apiUrl` 只从 provider config 读取，不写进 `AgentProfile`。
- `modelId` 通过 role 的 `modelRef` 解析得到，不在 agent loop 里硬编码。
- `systemPrompt` 通过 role 的 `systemPromptRef` 解析得到，不在 agent loop 或 provider 里硬编码。
- fallback 必须记录原因，例如 `missing_agent_role`、`missing_model_ref`、`missing_provider`、`provider_unavailable`。
- 产品运行时如果所有真实 provider 都不可用，要返回配置错误并引导用户设置 provider。
- API key 只通过 `apiKeyEnvName` 或后续 `SecretStore` 读取，不进入 prompt、不写入 event payload。

Prompt 来源和映射规则：

- 参考来源：Amp Code System Prompt 2025-10-25 gist。
- 能对应 Floris AI 当前设计的内容直接进入默认 prompt，包括 Agency、Conventions & Rules、AGENTS.md file、Context、Communication。
- Amp 的 Task Management 进入 `coder` prompt，用于指导默认执行 agent 做任务拆分和状态更新。
- Amp 的 Oracle 进入 `oracle` prompt，用于显式 `@oracle` 或 visible handoff，不实现隐藏后台 oracle。
- Amp 专属品牌、Sourcegraph/Amp 说明、具体工具名、tool JSON schema、Amp 官网查询说明、环境样例不进入默认 prompt。
- shared prompt 只能描述 Floris AI agent runtime，不把整个产品永久写成 coding agent。coding 角色限定在 `coder` prompt。

设计要求：

- agent loop 只能依赖 `ModelProvider`，不能直接依赖具体 SDK。
- `ModelProvider.createMessage()` 返回 `AsyncIterable<ModelEvent>`，不要一次性返回完整 response。
- OpenAI-compatible 真实 provider 使用官方 `openai` SDK，第三方 OpenAI-compatible 平台通过 `apiUrl` / SDK `baseURL` 接入。
- provider adapter 负责把 SDK response 转成 Floris AI 内部事件，agent loop 不处理 SDK 原始对象。
- `tool_call_delta` 这类 provider 原始 streaming 细节不进入 agent loop。后续 streaming adapter 内部完成 delta 拼接。
- Provider 不负责 tool 执行、permission、hook、session 写入或 API key 存储。
- Lesson 1 使用 env 读取 MIMO API key。后续真实产品可以通过 `SecretStore` adapter 替换 env 读取；runtime 不直接依赖 macOS Keychain。
- Provider 不负责选择 `AgentRole`。role resolution 在 provider 创建之前完成，provider 只接收已经解析好的 `providerId`、`apiUrl`、`modelId`。
- Provider 不负责管理 system prompt。prompt 在 ContextBuilder 前解析，作为 context section 进入 `ModelRequest`。

Lesson 1 的 `ModelEvent`：

- `text_delta`：模型输出一段文本。
- `tool_call_done`：模型完成一个 tool call 请求，包含 `id`、`name`、`input`。
- `usage`：token usage 统计。
- `done`：本次 provider 请求结束，包含 `stopReason`。
- `error`：provider 层错误，agent loop 转成 `provider_error` stop reason 或可记录 event。

实现文件：

- `src/types/provider.type.ts`：`ModelProvider`、`ModelRequest`、`ModelEvent`、provider config 和 resolver result 类型。
- `src/types/agent.type.ts`：`AgentProfile`、`AgentRole`、`AgentRoleDefinition`、`ModelRef`、agent model fallback policy。
- `src/types/prompt.type.ts`：`PromptTemplate`、`SystemPromptRef`、`AgentRolePrompt`、`PromptStore`。
- `src/types/message.type.ts`：本小节需要的最小 message contract。
- `src/types/provider-config.type.ts` 或 `src/types/provider.type.ts`：`AgentConfig`、`ProviderConfig`、`ModelConfig`、`RoleModelConfig`。Lesson 1 可以先放在 `provider.type.ts`，后续配置复杂后再拆文件。
- `src/providers/model-provider.ts`：只导出 provider contract 或薄 wrapper，不放 SDK 代码。
- `src/providers/openai-compatible-provider.ts`：OpenAI-compatible provider class，只负责调用 SDK 和输出 `ModelEvent`。
- `src/providers/openai-compatible-provider-factory.ts`：从 env 读取 API key，检查后创建 OpenAI-compatible provider。
- `src/providers/utils/openai-client.ts`：创建 OpenAI SDK client 和读取必需 API key。
- `src/providers/utils/openai-request-mapper.ts`：`ModelRequest` 到 OpenAI Chat Completions params 的映射。
- `src/providers/utils/openai-event-mapper.ts`：OpenAI SDK response 到 `ModelEvent` 的映射。
- `src/prompts/default-agent-role-prompts.ts`：默认 agent role system prompts。
- `src/providers/provider-resolver.ts`：把 `agent.config.ts` + `AgentRole` 解析成具体 `ModelProvider` 或 typed configuration error。
- `tests/agent-profile.test.ts`：`AgentProfile` 必须显式引用 system prompt，默认 prompts 覆盖内置 roles。
- `tests/provider-resolver.test.ts`：role mapping、默认 role fallback、model fallback、缺失 provider 错误。

测试：

- 按顺序输出事件。
- abort 后停止输出。
- provider error 可以被模拟。
- agent loop 或 provider 测试不直接 new 真实 SDK client。
- `AgentProfile` fixture 必须显式引用 system prompt。
- 默认 agent role prompts 覆盖 `coder`、`oracle`、`reviewer`、`explorer`。
- 默认 role prompts 包含 Amp 映射后的 shared sections，并保留 role-specific boundaries。
- `coder` role 能解析到配置里的 provider 和 model。
- 未配置的 role fallback 到 `defaultRole`。
- role 的主 model 缺失时按 `fallbackModelRefs` 尝试。
- provider 缺失或不可用时返回 typed configuration error，不让 agent loop crash。
- fallback 结果写入 event 或 resolver result，方便 UI 展示实际使用的 provider/model。

### Lesson 1.3 ToolRegistry and first tool

状态：learning complete in `lesson1-agent-loop-basic-debug`

目标：

- 定义 `Tool`、`ToolExecutionContext`、`ToolResult`。
- 实现 `ToolRegistry`。
- 实现 `echo_tool`。
- 为下一步真实 coding agent tools 定义 token-aware tool architecture。
- 补充结构化 trace 和可视化观察基础，避免多轮 tool call 只能靠 command output 阅读。

设计要求：

- agent loop 不 import 具体 tool。
- 未知 tool 返回结构化错误。
- tool result 可写入 event log。
- tool result 不能只是一段字符串。后续真实 tool 必须区分 `summary`、`display`、`context`、`rawRef`、`metrics`，避免把命令日志、HTTP body、git diff 这类大输出直接放进 model context。
- token 优化要内置在 tool layer 和 context pipeline 中，不依赖用户手动要求 agent 少输出。

后续真实 tool layer 的两层过滤：

1. Tool 自身过滤：每个 tool 按自己的领域做输出优化，例如 `git_diff` 输出 file stats 和 scoped hunks，`http_request` 按 content type 摘要，`run_command` 按 test/lint/build/git 等 command kind 提取重点。
2. Runtime 过滤：`PostToolUse` 记录 raw output、optimized output、token metrics 和省略原因；`BeforeContextBuild` / context budget guard 再决定哪些 tool result 能进入下一轮 model context。

当前 tool 进度：

| Tool | 用途 | 进度 |
| --- | --- | --- |
| `echo_tool` | 教学 echo，验证 tool call / result 回填 | 已实现，教学工具 |
| `list_files` | 列 workspace 结构 | 已实现 MVP |
| `read_file` | 读取文件片段 | 已实现 MVP，支持源码 excerpt budget guard |
| `search_files` | 搜索内容 | 已实现 MVP |
| `run_command` | 执行受控短命令 | 已实现 MVP，长命令生命周期未完成 |
| `git_status` | 查看 git 状态 | 已实现 MVP |
| `http_request` | smoke test 本地服务或 API | 已实现 MVP |
| `get_command_status` | 查询长命令状态 | 未实现 |
| `get_command_output` | 分页读取长输出 | 未实现 |
| `stop_command` | 停止长命令 | 未实现 |
| `apply_patch` | patch 修改文件 | 未实现 |
| `git_diff` | 查看 diff 摘要和 scoped diff | 未实现 |
| `list_tasks` | 发现 package scripts / Makefile / justfile | 未实现 |
| `run_task` | 跑 test / lint / build / dev | 未实现 |

自定义和三方库取舍：

- 自定义：tool envelope、command runner、process store、output optimizer、token metrics、permission metadata、artifact store。这些是 Floris 的核心能力，必须可解释、可测试、可回放。
- 三方库：ignore rules、glob matching、diff / patch parsing、MIME detection。这些是底层格式问题，不应该消耗项目精力重复实现。
- 暂不使用 `execa`、`axios`、`shelljs`、`simple-git`。command 执行、安全边界、stdout/stderr 管理和 token 优化都要在 runtime 内部完成。
- 不提供 `rtk` adapter。Floris 内置等效的输出优化策略，方便调试、验证和观察这些策略对 LLM 行为的影响。

完整设计见 `docs/teaching/lesson1/tool-architecture.md`。

#### Lesson 1.3.x Structured Trace and Visual Observation

状态：implemented with local MLflow demo

目标：

- 把 Agent Loop 运行过程从 console log 升级为可保存、可查询、可视化的结构化 trace。
- 让 trace 同时服务开发调试、教学讲解、后续 Context Inspector、benchmark 失败分析。
- 优先尝试接入 MLflow Tracing；如果 MLflow 接入成本过高或实时观察不满足需求，则实现 Floris 自己的简易 web trace flow。

独立设计文档：

- `docs/architecture/mlflow-tracing.md`
- `docs/architecture/mlflow-prompt-and-agent-versioning.md`

为什么放在 Lesson 1.3：

- tools 会把 agent loop 从单次 provider call 变成多轮状态机。
- `run_command`、`http_request`、`git_diff` 这类 tool 输出天然需要 raw artifact、summary、context output、token metrics。
- 如果继续只在 command output 打印日志，多轮 tool call、长输出过滤、provider retry、tool error 都很难阅读和复盘。
- benchmark 也需要相同的结构化运行记录，否则后期只能重新补 instrumentation。

设计要求：

- 新增 `trace.type.ts`，定义 `TraceRecorder`、`TraceRunHandle`、`TraceSpanHandle`、provider event 和 run finish contract。
- `AgentEvent` 继续作为产品/session 事件；trace 作为开发观察和 benchmark artifact，二者通过 `runId`、`threadId`、`branchId`、`toolCallId` 关联。
- trace 必须记录：
  - run start / stop。
  - context build token estimate。
  - provider request start / finish / error。
  - provider event count、stop reason、usage。
  - tool start / finish / error。
  - tool raw tokens、context tokens、reduction ratio、truncated、`rawRef`。
  - final stop reason、total usage、run metrics。
- trace 不保存 secret 原文；tool output 和 provider payload 进入 trace 前要走 redaction / summary。
- runtime 默认不打印 agent loop 过程日志。demo 默认启用 MLflow trace，console 只输出最终 summary 和必要错误。

MLflow 优先方案：

- Floris 内部 trace contract 不直接依赖 MLflow SDK。
- 新增 `MlflowTraceRecorder` adapter，把 Floris trace 事件映射到 MLflow spans。
- 当前不引入 OpenTelemetry 设计，直接使用 `mlflow-tracing` TypeScript SDK。
- 使用 MLflow JS/TS tracing 能力，把一次 agent run 展示为一个 trace：
  - root span: `agent.run`
  - child span: `context.build`
  - child span: `model.request`
  - child span: `tool.<name>`
- span attributes 使用稳定 Floris 字段，例如 `floris.run_id`、`floris.thread_id`、`floris.branch_id`、`floris.agent_id`、`floris.tool.name`、`floris.stop_reason`、`floris.usage.total_tokens`。
- root span outputs 写入 `usage` 和 `metrics`，方便查看单次 trace 的总 token、model request 次数和 tool call 次数。
- 单个 `model.request` span 写入本次 provider usage，方便定位是哪次请求触发高 token 消耗或 `max_tokens`。

`maxIterations` 和 provider `max_tokens`：

- `maxIterations` 表示 agent loop 的 tool round budget，不等于模型输出 token 上限。
- 达到 `maxIterations` 时，默认追加一次 no-tool final synthesis request，让 agent 基于已有 observation 给出结论。
- provider 返回 `max_tokens` 且没有 tool call 时，Agent Loop 返回 `provider_max_tokens`，避免把截断回答误认为 `assistant_done`。
- 默认 code agent 输出上限使用通用策略，不按 demo case 特判：普通 provider request 默认 `4096`，final synthesis request 覆盖到 `8192`。

tool output budget：

- 默认 tool context budget 使用 `1600`，避免中等源码文件被压成过短 summary。
- `read_file` 超过 context budget 时保留真实源码 excerpt，不降级成一句 summary。
- `read_file` 的 line range / maxLines 是用户和 agent 精确读取源码的主要方式，后续 Context Inspector 应能展示 excerpt 和 `rawRef`。

自定义 web trace flow fallback：

- 如果 MLflow 在本地开发期安装、启动或实时观察成本过高，先实现简易 web viewer。
- viewer 可以读取 JSONL trace 文件，展示：
  - 左侧 run list。
  - 中间 timeline / span tree。
  - 右侧 selected span details。
  - tool input、summary、context output、rawRef、token metrics。
  - event sequence 和 stop reason。
- 第一版 viewer 只服务本地开发，不作为 macOS 产品 UI。
- viewer 的输入必须是同一份 trace JSONL，避免为了 UI 再维护一套数据。

benchmark 关系：

- benchmark runner 复用 `TraceStore`。
- deterministic benchmark 使用 scripted provider，不依赖真实网络和模型随机性。
- 每个 benchmark case 输出 trace 文件，失败时可以直接用 MLflow 或 web viewer 打开。
- 第一批断言包括 stop reason、event sequence、tool call sequence、usage、output filtering metrics、trace JSONL parseability。

实现文件建议：

- `src/types/trace.type.ts`
- `src/trace/mlflow-trace-recorder.ts`
- `src/core/agent-loop-trace.ts`
- `tests/agent-loop-trace.test.ts`

暂不做：

- 不在 Lesson 1.3 做完整 OpenTelemetry collector 管理。
- 不要求用户必须安装 MLflow 才能跑 demo。
- 不把 MLflow trace ID 作为 Floris 内部唯一 ID。
- 不做生产级 telemetry backend。
- 不做完整 macOS Trace Inspector UI。

测试：

- 注册并执行 `echo_tool`。
- 未知 tool 不 crash。
- tool 抛错后返回可记录错误。
- 后续真实 tool 必须覆盖输出压缩、raw artifact、token metrics、redaction 和错误路径。
- trace recorder 收到 run、context、model、tool span。
- 多轮 tool call 的 trace span parent/child 关系后续用 recorder 断言。
- MLflow exporter 可以用 mock trace recorder 测试，不要求单元测试启动 MLflow server。

### Lesson 1.4 Context, prompt, memory, session, and permission stubs

状态：not implemented as capability

目标：

- 实现 `ContextBuilder`。
- 解析 `AgentProfile.systemPrompt`，并作为独立 context section。
- 实现内存版 `MemoryStore`。
- 实现 `InMemorySessionStore`。
- 实现 no-op `PermissionGate` 或接口占位。

任务：

- 定义 `ContextSection`。
- 定义 context builder 如何接收解析后的 `PromptTemplate`。
- 读取根目录 `AGENTS.md` 作为 project instructions。
- 支持 recent messages、memory entries、tool results sections。
- 支持 append event 和 list events。
- 为 JSONL persistence 保留 session store 接口。

设计要求：

- context 由 section 组成，不直接拼一整个字符串。
- 每个 section 有 `kind`、`title`、`content`、`tokenEstimate`。
- token estimate 第一版使用字符数 / 4。
- no-op permission gate 必须出现在 tool execution path 中，后续才能替换成真实策略。

测试：

- `ContextBuilder` 能输出 section 列表。
- `ContextBuilder` 能输出来自 `AgentProfile.systemPrompt` 的独立 `system` section。
- 可以包含 `AGENTS.md`。
- 可以加入 recent messages 和 memory entries。
- event 按顺序写入 session store。
- no-op permission gate 不阻止默认 demo tool。

### Lesson 1.5 AgentLoop MVP state machine and stop reasons

状态：partial, basic call path exists in `lesson1-agent-loop-basic-debug`

目标：

- 实现 `AgentLoop.runTurn()`。
- 集成 provider、tool registry、hook runner、context builder、session store、permission gate。
- 实现 `assistant_done`、`tool_use`、`max_iterations`、`provider_error`、`user_interrupted`、`tool_error`、`stop_blocked`。

类型归属：

- `src/types/runtime.type.ts`：`LoopState`、`RunTurnInput`、`RunTurnResult`、`LoopStopReason`。
- `src/types/session.type.ts`：agent loop 写入的 `AgentEvent` 基础结构。

执行路径：

```text
UserPromptSubmit
  -> SessionStart if needed
  -> BeforeContextBuild
  -> ContextBuilder.build
  -> AfterContextBuild
  -> ModelProvider.createMessage
  -> tool call?
      -> PreToolUse
      -> PermissionGate.check
      -> ToolRegistry.execute
      -> PostToolUse
      -> next iteration
  -> Stop
  -> done
```

Agent loop event log 应该包含：

- user message。
- context sections。
- model requested tool。
- tool result。
- final answer。
- stop reason。

测试：

- 无 tool call，直接结束。
- 一次 tool call 后结束。
- 连续 tool call 超过 `maxIterations`。
- provider error。
- abort。
- `Stop` hook 阻止停止。

### Lesson 1.6 Stream Rendering Web UI

状态：not implemented

目标：

- 提供 stream rendering Web UI，用流式方式渲染 agent run。
- 使用 SSE 作为第一版 transport，但产品目标是增量渲染 chat / timeline，而不是只展示原始 event log。
- 同步教学笔记和实现拆解。
- 把前面 5 个小节跑成一条完整用户可见路径。

Web UI 验收输出应该包含可增量渲染的内容：

- user message。
- assistant text delta / final assistant message。
- tool call started / finished。
- tool result summary。
- context build summary。
- stop reason 和 error state。
- MLflow trace id 或 trace link。

第一版 stream rendering 边界：

- 只做本地开发 UI，不做生产 macOS app。
- 使用一个轻量 HTTP server 提供页面和 `/runs` stream endpoint。
- transport 第一版使用 SSE；事件格式要保持和未来 macOS app bridge 可复用。
- 页面包含输入框、Run 按钮、assistant message 流式渲染、tool timeline、final answer、stop reason、trace link。
- runtime 仍然复用 `packages/agent-runtime`，Web UI 不实现 agent loop。
- stream event 使用 agent event / trace summary，不传 secret 原文。
- CLI demo 可以保留为 smoke script，但不再作为 Lesson 1.6 的主要交付。

stream event 最小 contract：

```text
run.started
message.delta
message.completed
tool.started
tool.completed
context.built
run.completed
run.failed
```

设计重点：

- UI 不能等整个 run 完成后一次性渲染。
- assistant message 要按 delta 追加。
- tool call 要先出现 pending 状态，再更新为 success / error。
- final answer 由 message deltas 组成，不再只依赖最后的 JSON summary。
- MLflow trace 仍作为深度观察入口，Web UI 只展示用户需要的运行过程。

为什么从 CLI 改为 stream Web UI：

- 主流 AI agent 产品的核心体验是可观察的 chat / run timeline，而不是 terminal output。
- stream rendering 更接近真实用户体验：用户能看到 agent 正在思考、调用 tool、拿到结果和继续生成。
- SSE 更贴近后续 macOS app bridge 的 event protocol，但不是唯一目标；核心是稳定的 stream event contract。
- Web UI 能更早暴露 partial message、tool pending state、stop reason、trace link 和用户体验问题。

测试：

- Web UI server 可以启动。
- stream endpoint 可以输出 `run.started`、`message.delta`、`tool.started`、`tool.completed`、`run.completed`。
- 前端 reducer 可以把 stream events 合成为 assistant message 和 tool timeline。
- scripted provider 下能跑到 `assistant_done`。
- `bun run typecheck` 通过。
- `bun run test` 通过。
- `bun run check` 通过。

文档同步：

- 更新 `docs/teaching/lesson1/notes.md`。
- 更新 `docs/teaching/lesson1/implementation-breakdown.md`。
- 在本计划中把完成的小节状态改成 done。

### Lesson 1.7 HookRunner MVP

状态：not implemented

目标：

- 定义内部 typed hook event。
- 实现 `HookRunner`。
- 支持同步或异步 hook。
- 把 hook 接入 AgentLoop、tool execution、context build 和 stop path。

第一版 hooks：

- `SessionStart`
- `BeforeContextBuild`
- `AfterContextBuild`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `UserInterrupt`

设计要求：

- hook 调用顺序稳定。
- hook result 写入 event log 或返回给 caller。
- `PreToolUse` 可以 block。
- `Stop` 可以返回 `continue`。
- Stream Web UI 能看到 hook block 或 hook warning 的结构化事件。

测试：

- 调用顺序。
- `PreToolUse` block tool。
- `Stop` 阻止停止。
- hook event 能进入 session event / stream event。

## 运行命令

计划中的命令：

```bash
cd packages/agent-runtime
bun install
bun run typecheck
bun run test
bun run demo
```

## 风险和取舍

- demo 依赖真实 AI API 平台，能观察 token usage，但本地离线环境不能完整复现 demo。
- 当前 tools 是 MVP：`read_file`、`list_files`、`search_files`、`git_status`、`http_request`、`run_command` 已能支持基本观察和 demo，但权限、长命令生命周期、patch 写入和 diff 仍要后续补。
- In-memory session store 不能恢复进程重启，但接口要为 JSONL / SQLite 留好位置。
- Web UI 先做 stream rendering，不做完整前端产品；它服务 Lesson 1 的可观察 agent run。
- HookRunner 移到 Lesson 1 最后，先让 agent run、context、session、permission stub 和 stream event 路径稳定，再补内部 lifecycle extension。
- Context token estimate 先粗略估算，后续 provider adapter 再提供更准确实现。

## 当前 tag 完成标准

- Lesson 1.1 到 Lesson 1.3 的学习内容可以根据 tag 查看。
- Stream Web UI 可以增量渲染最小 agent run，并观察 assistant delta、tool call、stop reason 和 trace link。
- MLflow trace 可以展示 provider request、provider event、tool result、stop reason。
- 单次 provider call 的 duration、event count、stop reason 和 usage 进入 MLflow span attributes。
- `bun run check`、`bun run typecheck`、`bun test` 通过。

后续每次增强 Lesson 1 的能力，都必须在本计划中补充“小节 -> tag”的对应关系，让学习者能按 tag 逐步查看实现过程。

## Lesson 1 完整完成标准

- 所有小节状态更新为 done。
- `bun run typecheck` 通过。
- `bun run test` 通过。
- `bun run demo` 成功跑通。
- 教学笔记和实现拆解已更新。
- 用户可以按 `docs/teaching/lesson1/README.md` 独立理解设计，按本计划独立实现 MVP。
