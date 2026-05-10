# Lesson 1 教学笔记

## 当前实现边界

当前代码 tag 覆盖 Lesson 1.1 到 Lesson 1.3 的学习目标，并额外提供 **agent-loop 最基本调用 + debug 可观测** demo。

这个里程碑证明：

- Lesson 1.1：runtime package、目录、类型管理、测试工具链已经足够支撑后续开发。
- Lesson 1.2：`ModelProvider`、OpenAI-compatible provider、MIMO config、role resolver 的边界已经能讲清楚。
- Lesson 1.3：`ToolRegistry` 和 `echo_tool` 已经能解释 tool call 到 tool result 的回填路径。
- Debug demo：可以看到最小 agent loop 如何闭环。

```text
user message
  -> AgentLoop
  -> provider call
  -> optional tool call
  -> tool result 回填
  -> second provider call
  -> stop reason
  -> DEBUG 日志观察全过程
```

Lesson 1.4 之后还没有真正完成。context/session 当前只是为了支撑 demo 的最小 stub，不能算 context window 或 session persistence。

当前已经跑通：

- runtime package、类型目录、测试工具链。
- `ModelProvider` 抽象、OpenAI-compatible provider。
- MIMO config 选项、env API key 读取、role 到 provider / model 的 resolver。
- `echo_tool` 和 `InMemoryToolRegistry`。
- `BasicContextBuilder`，只构建最小 system prompt、messages 和 token estimate；这不是 context window。
- `InMemorySessionStore`，只记录本轮 agent events；这不是 session persistence。
- `AgentLoop.runTurn()`，支持 provider call、tool call、tool result 回填、停止条件和 event log。
- `run-demo.ts` 通过 MIMO 跑完整 chat agent loop，并用 DEBUG 日志观察 provider request / event / 单次 token usage。

还没有真正实现：

- Context Window / Context Inspector。
- session persistence、JSONL / SQLite、branch tree 恢复。
- HookRunner 的真实事件调度。
- PermissionGate 和 PolicyReviewer。
- MemoryStore、memory selection、compaction。
- file tools、shell tools、git tools。
- SwiftUI bridge 和 UI 展示。

学习者应该把当前 tag 当成 Lesson 1.1 到 Lesson 1.3 的学习完成点：先理解 runtime skeleton、provider boundary、tool registry，再通过 DEBUG 日志观察最小 agent loop。后续再继续补 HookRunner、session、context window、permission、memory。

当前学习 tag：

```text
lesson1-agent-loop-basic-debug
```

这个 tag 表示 Lesson 1.1 到 Lesson 1.3 的学习内容已经足够，外加 basic agent-loop debug demo。它不是 Lesson 1 全部完成。

## 小节状态

| 小节 | 当前状态 | 说明 |
| --- | --- | --- |
| 1.1 Runtime skeleton | learning complete in `lesson1-agent-loop-basic-debug` | package、目录、TS、test、lint 已可用。 |
| 1.2 ModelProvider / provider boundary | learning complete in `lesson1-agent-loop-basic-debug` | provider contract、OpenAI-compatible provider、MIMO config、resolver 已可用，足够学习 provider boundary。 |
| 1.3 ToolRegistry | learning complete in `lesson1-agent-loop-basic-debug` | `echo_tool` 和 registry 足够学习 tool call 回填路径。 |
| 1.4 HookRunner | not implemented | 只有占位，没有真实 hook pipeline。 |
| 1.5 Context / memory / session / permission | not implemented as capability | context/session 只是最小 stub；context window、memory、permission 没有实现。 |
| 1.6 AgentLoop | partial in `lesson1-agent-loop-basic-debug` | basic call path 已存在，用于支撑 demo；完整状态机后续继续补。 |
| 1.7 CLI demo | partial in `lesson1-agent-loop-basic-debug` | debug demo 可运行；完整 lesson 收尾文档和更完整验证后续继续补。 |

后续每次修改 Lesson 1，都要在本表或 plan 文档里写清楚新增能力对应哪个 tag。

## Lesson 1.1 Runtime skeleton

### 目标

建立 `packages/agent-runtime`，让后续 runtime 代码和测试都在稳定目录内演进。

### 关键文件

- `packages/agent-runtime/package.json`
- `packages/agent-runtime/tsconfig.json`
- `packages/agent-runtime/vitest.config.ts`
- `packages/agent-runtime/src/types/*.type.ts`
- `packages/agent-runtime/tests/*.test.ts`

### 学习重点

类型集中放在 `src/types/*.type.ts`。实现文件只通过 `import type` 引用跨模块 contract，避免类型散落在业务代码里。

## Lesson 1.2 ModelProvider, config, and provider boundary

### 目标

让 agent loop 只依赖 `ModelProvider`，不直接依赖 OpenAI SDK 或 MIMO。

### 关键文件

- `src/types/provider.type.ts`
- `src/providers/openai-compatible-provider.ts`
- `src/providers/openai-compatible-provider-factory.ts`
- `src/providers/provider-resolver.ts`
- `src/config/mimo-agent-config.ts`
- `src/providers/utils/openai-client.ts`
- `src/providers/utils/openai-request-mapper.ts`
- `src/providers/utils/openai-event-mapper.ts`

### 数据流

```text
AgentRole
  -> resolveProviderForRole(config, role, { providerType })
  -> modelRef
  -> provider config
  -> createOpenAICompatibleProviderFromEnv()
  -> OpenAICompatibleModelProvider
  -> ModelEvent stream
```

### 当前实现

- `resolveProviderForRole()` 通过 `providerType` 参数选择 provider 创建逻辑，不使用 callback 隐藏主流程。
- `createOpenAICompatibleProviderFromEnv()` 从 env 读取 `apiKeyEnvName`，缺 key 时返回精确 `missing_api_key`。
- `OpenAICompatibleModelProvider` 使用 OpenAI SDK 的 `baseURL` 支持 OpenAI-compatible 平台。
- provider 内部缓存 SDK client，避免一次运行重复创建 client。
- MIMO 是当前阶段的 provider 选项，不是产品默认配置。

### 当前简化

- 只支持 `providerType: "openai-compatible"`。
- Anthropic / local provider 还没有 adapter。
- SecretStore 还没有实现，当前只读 env。

## Lesson 1.3 ToolRegistry and echo_tool

### 目标

让模型请求 tool 时，agent loop 通过 registry 执行 tool，而不是直接 import 某个 tool 函数。

### 关键文件

- `src/types/tool.type.ts`
- `src/tools/tool-registry.ts`
- `src/tools/echo-tool.ts`
- `tests/tool-registry.test.ts`

### 数据流

```text
provider tool_call_done
  -> AgentLoop
  -> ToolRegistry.execute(name, input)
  -> ToolResult
  -> tool message
  -> next provider request
```

### 当前简化

- 只有 `echo_tool`。
- 没有 file / shell / git tools。
- 没有 permission check。

## Lesson 1.4 HookRunner

### 当前状态

还没有真实实现。目录和测试占位存在，但没有 typed hook pipeline。

### 后续要补

- `SessionStart`
- `BeforeContextBuild`
- `AfterContextBuild`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `UserInterrupt`

HookRunner 真正接入后，agent loop 才能在 context、tool、stop 等关键点给扩展和安全策略留入口。

## Lesson 1.5 Context, session, memory, permission

### 当前实现

- `BasicContextBuilder` 会生成最小 system prompt、messages 和粗略 token estimate。
- `InMemorySessionStore` 会记录 agent events，供 demo 和测试观察。

### 关键文件

- `src/context/context-builder.ts`
- `src/types/context.type.ts`
- `src/session/in-memory-session-store.ts`
- `src/types/session.type.ts`

### 当前简化

- 还没有读取 `AGENTS.md` 作为真实 project instructions section。
- 还没有 context window、context inspector、include / exclude。
- 还没有 memory store。
- 还没有 permission gate。
- session 不是 persistence，只是内存事件列表。

## Lesson 1.6 AgentLoop MVP

### 目标

实现一轮 user message 到 final answer 的最小闭环。

### 关键文件

- `src/core/agent-loop.ts`
- `src/types/runtime.type.ts`
- `tests/agent-loop.test.ts`

### 数据流

```text
runTurn()
  -> append user_message event
  -> contextBuilder.build()
  -> provider.createMessage()
  -> consume ModelEvent
  -> execute tool if needed
  -> append tool result message
  -> provider.createMessage()
  -> stop
```

### 当前 stop reasons

- `assistant_done`
- `max_iterations`
- `provider_error`
- `user_interrupted`
- `tool_error`

`tool_use` 目前是 provider request 的中间 stop reason，不是 `RunTurnResult` 的最终成功状态。

### 当前简化

- 没有 hook。
- 没有 permission。
- 没有 branch tree。
- 没有真实 persistence。

## Lesson 1.7 CLI demo and DEBUG logs

### 目标

提供可运行 demo，让学习者看到 agent loop 的真实调用过程。

### 关键文件

- `src/demo/run-demo.ts`
- `src/demo/utils/debug-logger.ts`
- `src/demo/utils/debug-model-provider.ts`
- `src/demo/utils/debug-session-store.ts`
- `src/types/log.type.ts`

### Demo 路径

```text
bun run demo
  -> MIMO config
  -> OpenAI-compatible provider
  -> real provider request
  -> provider returns events and usage
```

### DEBUG 日志

`run-demo.ts` 显式设置 `DEBUG = true`。日志格式：

```text
HH:mm:ss sss[agentLoop][createMessage] provider request #0
```

object 使用格式化 JSON 输出。`DebugModelProvider` 会给每次 provider call 分配 `callId`，并在结束时打印：

- `durationMs`
- `eventCount`
- `stopReason`
- 本次 `usage`

### 当前简化

DEBUG logger 只服务 demo。runtime 内部默认不打印日志，后续 UI 观察能力应基于 event stream 和 session persistence，而不是 console log。

## 验证命令

```bash
cd packages/agent-runtime
bun run check
bun run typecheck
bun test
bun run demo
```

当前环境里 `bun run demo` 如果无法访问 MIMO 网络，会返回 provider `Connection error.`。这说明 provider path 已走到真实网络请求边界。
