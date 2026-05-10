# Lesson 1 MVP Agent Loop 实现计划

## 状态

当前状态：in progress

本计划对应教学规划：

- `docs/teaching/lesson1/README.md`
- `docs/architecture/agent-loop-implementation-paradigm.md`

## 实现目标

实现一个 TypeScript `agent-runtime` MVP。它能通过正式 `ModelProvider` path 加 mock transport 跑通一次 agent turn：

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

本轮实现：

- TypeScript runtime package。
- ModelProvider + ProviderTransport + mock transport。
- Prompt contracts + default agent role system prompts。
- Tool registry。
- Agent loop MVP。
- 内部 typed hooks。
- Context builder MVP。
- Memory store MVP。
- In-memory session store。
- No-op permission gate 或接口占位。
- CLI demo。
- 单元测试。

本轮不实现：

- 真实 LLM provider。
- SwiftUI。
- 真实权限审核 agent。
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
        provider-transport.ts
        model-provider-proxy.ts
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
      provider-transport.test.ts
      tool-registry.test.ts
      hook-runner.test.ts
      context-builder.test.ts
      agent-loop.test.ts
```

## 小节计划

Lesson 1 固定为 7 个小节。README、plan、notes、implementation breakdown 都使用同一套小节编号。

### Lesson 1.1 Runtime skeleton, package layout, and baseline tooling

状态：done

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

状态：planned

目标：

- 定义 `ModelProvider`、`ModelRequest`、`ModelEvent`、`ProviderTransport`。
- 定义 `PromptTemplate`、`SystemPromptRef`、`PromptStore`。
- 定义 `AgentProfile.systemPrompt` 和 `AgentRoleDefinition.systemPrompt`。
- 基于 Amp Code system prompt 提供默认 `coder`、`oracle`、`reviewer`、`explorer` system prompt。
- 定义 `agent.config.ts` 里 provider、model、agent role 的最小配置形状。
- 定义 `AgentRole` 到 `ModelProvider` 的解析流程和 fallback 规则。
- 实现 `TransportBackedModelProvider` 或等价 provider wrapper。
- 实现 `MockProviderTransport`，用于测试和 demo。

设计模式选择：

- `ModelProvider` 使用 Strategy。`AgentLoop` 只依赖这个接口，不关心 Anthropic、OpenAI、本地模型或 mock。
- 真实 provider 接入时使用 Adapter。不同 SDK 的 request、response、stop reason、tool call shape 都转成 Fate AI 内部 `ModelRequest` / `ModelEvent`。
- `ProviderTransport` 使用 Proxy / Decorator 思路。真实网络请求、mock、日志、retry、rate limit、record / replay 都在这个请求发送边界扩展。
- `ModelEvent` stream 使用 `AsyncIterable`。Provider 可以流式输出 `text_delta`、`tool_call_done`、`usage`、`done`、`error`，UI 和 session 后续都能逐步消费。
- 模型返回的 tool call 按 Command 思路处理：provider 只产出 `{ id, name, input }`，执行交给 `ToolRegistry`。

不采用：

- 不使用继承式 `BaseProvider` + subclass。Provider 差异用 adapter 和 plain object contract 表达，避免把 OpenAI / Anthropic / local model 的差异塞进父类模板。
- 不使用 Abstract Factory。Lesson 1 只有一个 OpenAI-compatible provider factory 和一个 mock transport，还不需要 provider registry 或复杂创建逻辑。
- 不让 `MockProviderTransport` 成为一个可被 agent profile 选择的 provider。它只是 transport 边界上的测试替身。

推荐结构：

```text
test / demo:
AgentLoop
  -> ModelProvider
      -> TransportBackedModelProvider
          -> ProviderTransport
              -> MockProviderTransport

real OpenAI-compatible provider:
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
- 当前阶段选用参数：`maxCompletionTokens: 1024`、`temperature: 1`、`topP: 0.95`、`frequencyPenalty: 0`、`presencePenalty: 0`、`stop: null`。
- `coder`、`oracle`、`reviewer`、`explorer` 在当前阶段都映射到同一个 MIMO model，避免某个 `AgentRole` 无法运行。

推荐最小形状：

```ts
export default defineAgentConfig({
  defaultRole: "coder",
  providers: {
    mimo: {
      kind: "openai",
      apiUrl: env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1",
      apiUrlEnv: "MIMO_BASE_URL",
      apiKeyEnv: "MIMO_API_KEY",
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
        maxCompletionTokens: 1024,
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
  -> read MIMO_API_KEY from env when apiKeyEnv is configured
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
- 产品运行时如果所有真实 provider 都不可用，要返回配置错误并引导用户设置 provider。不能自动切到 `MockProviderTransport`。
- test 和 demo 可以显式注入 `MockProviderTransport`，但这条 path 不进入用户配置。
- API key 只通过 `apiKeyEnv` 或后续 `SecretStore` 读取，不进入 prompt、不写入 event payload。

Prompt 来源和映射规则：

- 参考来源：Amp Code System Prompt 2025-10-25 gist。
- 能对应 Fate AI 当前设计的内容直接进入默认 prompt，包括 Agency、Conventions & Rules、AGENTS.md file、Context、Communication。
- Amp 的 Task Management 进入 `coder` prompt，用于指导默认执行 agent 做任务拆分和状态更新。
- Amp 的 Oracle 进入 `oracle` prompt，用于显式 `@oracle` 或 visible handoff，不实现隐藏后台 oracle。
- Amp 专属品牌、Sourcegraph/Amp 说明、具体工具名、tool JSON schema、Amp 官网查询说明、环境样例不进入默认 prompt。
- shared prompt 只能描述 Fate AI agent runtime，不把整个产品永久写成 coding agent。coding 角色限定在 `coder` prompt。

Mock transport script 示例：

```ts
[
  { type: "tool_call_done", toolCall: { name: "echo_tool", input: { text: "hello" } } },
  { type: "done", stopReason: "tool_use" },
  { type: "text_delta", text: "tool returned hello" },
  { type: "done", stopReason: "end_turn" }
]
```

设计要求：

- agent loop 只能依赖 `ModelProvider`，不能直接依赖 `MockProviderTransport`。
- `ModelProvider.createMessage()` 返回 `AsyncIterable<ModelEvent>`，不要一次性返回完整 response。
- mock 必须在 provider 请求发送边界拦截，模拟真实 provider 返回的 `ModelEvent`。
- OpenAI-compatible 真实 provider 使用官方 `openai` SDK，第三方 OpenAI-compatible 平台通过 `apiUrl` / SDK `baseURL` 接入。
- provider adapter 负责把 SDK response 转成 Fate AI 内部事件，agent loop 不处理 SDK 原始对象。
- `tool_call_delta` 这类 provider 原始 streaming 细节不进入 agent loop。Lesson 1 mock 直接输出完整 `tool_call_done`，后续真实 adapter 内部完成 delta 拼接。
- `MockProviderTransport` 只用于 test 和 demo，不进入 agent profile，不作为产品 provider 选项。
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

- `src/types/provider.type.ts`：`ModelProvider`、`ModelRequest`、`ModelEvent`、`ProviderTransport`、transport request / event 类型。
- `src/types/agent.type.ts`：`AgentProfile`、`AgentRole`、`AgentRoleDefinition`、`ModelRef`、agent model fallback policy。
- `src/types/prompt.type.ts`：`PromptTemplate`、`SystemPromptRef`、`AgentRolePrompt`、`PromptStore`。
- `src/types/message.type.ts`：本小节需要的最小 message contract。
- `src/types/provider-config.type.ts` 或 `src/types/provider.type.ts`：`AgentConfig`、`ProviderConfig`、`ModelConfig`、`RoleModelConfig`。Lesson 1 可以先放在 `provider.type.ts`，后续配置复杂后再拆文件。
- `src/providers/model-provider.ts`：只导出 provider contract 或薄 wrapper，不放 SDK 代码。
- `src/providers/provider-transport.ts`：`ProviderTransport` 相关实现入口。
- `src/providers/model-provider-proxy.ts`：`TransportBackedModelProvider`，把 `ProviderTransport` 暴露成 `ModelProvider`。
- `src/providers/openai-compatible-provider.ts`：OpenAI-compatible provider class，只负责调用 SDK 和输出 `ModelEvent`。
- `src/providers/openai-compatible-provider-factory.ts`：从 env 读取 API key，检查后创建 OpenAI-compatible provider。
- `src/providers/utils/openai-client.ts`：创建 OpenAI SDK client 和读取必需 API key。
- `src/providers/utils/openai-request-mapper.ts`：`ModelRequest` 到 OpenAI Chat Completions params 的映射。
- `src/providers/utils/openai-event-mapper.ts`：OpenAI SDK response 到 `ModelEvent` 的映射。
- `src/prompts/default-agent-role-prompts.ts`：默认 agent role system prompts。
- `src/providers/provider-resolver.ts`：把 `agent.config.ts` + `AgentRole` 解析成具体 `ModelProvider` 或 typed configuration error。
- `tests/provider-transport.test.ts`：mock transport 的 replay、abort、error 测试。
- `tests/agent-profile.test.ts`：`AgentProfile` 必须显式引用 system prompt，默认 prompts 覆盖内置 roles。
- `tests/provider-resolver.test.ts`：role mapping、默认 role fallback、model fallback、缺失 provider 错误。

测试：

- 按顺序输出事件。
- abort 后停止输出。
- provider error 可以被模拟。
- agent loop 或 provider 测试不直接 new 真实 SDK client。
- mock transport 必须通过正式 `ModelProvider` path 驱动，不建立平行测试入口。
- `AgentProfile` fixture 必须显式引用 system prompt。
- 默认 agent role prompts 覆盖 `coder`、`oracle`、`reviewer`、`explorer`。
- 默认 role prompts 包含 Amp 映射后的 shared sections，并保留 role-specific boundaries。
- `coder` role 能解析到配置里的 provider 和 model。
- 未配置的 role fallback 到 `defaultRole`。
- role 的主 model 缺失时按 `fallbackModelRefs` 尝试。
- provider 缺失或不可用时返回 typed configuration error，不让 agent loop crash。
- fallback 结果写入 event 或 resolver result，方便 UI 展示实际使用的 provider/model。

### Lesson 1.3 ToolRegistry and first mock tool

状态：planned

目标：

- 定义 `Tool`、`ToolExecutionContext`、`ToolResult`。
- 实现 `ToolRegistry`。
- 实现 `echo_tool`。

设计要求：

- agent loop 不 import 具体 tool。
- 未知 tool 返回结构化错误。
- tool result 可写入 event log。

测试：

- 注册并执行 `echo_tool`。
- 未知 tool 不 crash。
- tool 抛错后返回可记录错误。

### Lesson 1.4 HookRunner MVP

状态：planned

目标：

- 定义内部 typed hook event。
- 实现 `HookRunner`。
- 支持同步或异步 hook。

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

测试：

- 调用顺序。
- `PreToolUse` block tool。
- `Stop` 阻止停止。

### Lesson 1.5 Context, prompt, memory, session, and permission stubs

状态：planned

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

### Lesson 1.6 AgentLoop MVP state machine and stop reasons

状态：planned

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

### Lesson 1.7 CLI demo, verification, teaching notes, and implementation breakdown

状态：planned

目标：

- 提供 CLI demo。
- 同步教学笔记和实现拆解。
- 把前面 6 个小节跑成一条完整路径。

Demo 验收输出应该包含：

- user message。
- context sections。
- model requested tool。
- tool result。
- final answer。
- stop reason。

测试：

- `bun run demo` 成功退出并输出 `assistant_done`。
- `bun run typecheck` 通过。
- `bun run test` 通过。
- `bun run check` 通过。

文档同步：

- 更新 `docs/teaching/lesson1/notes.md`。
- 更新 `docs/teaching/lesson1/implementation-breakdown.md`。
- 在本计划中把完成的小节状态改成 done。

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

- Mock transport 会让第一课稳定，但仍无法覆盖真实 provider streaming 的所有细节。后续 Lesson 2 补真实 adapter。
- `echo_tool` 很简单，但适合验证 loop。真实 file tool 后续补。
- In-memory session store 不能恢复进程重启，但接口要为 JSONL / SQLite 留好位置。
- HookRunner 先做内部 typed hooks，避免用户脚本带来的安全和兼容问题。
- Context token estimate 先粗略估算，后续 provider adapter 再提供更准确实现。

## 完成标准

- 所有小节状态更新为 done。
- `bun run typecheck` 通过。
- `bun run test` 通过。
- `bun run demo` 成功跑通。
- 教学笔记和实现拆解已更新。
- 用户可以按 `docs/teaching/lesson1/README.md` 独立理解设计，按本计划独立实现 MVP。
