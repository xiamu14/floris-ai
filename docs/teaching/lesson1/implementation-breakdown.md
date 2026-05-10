# Lesson 1 当前实现拆解

## 当前 tag 定位

当前 tag 覆盖 Lesson 1.1 到 Lesson 1.3 的学习目标，并额外提供一个 **agent-loop 最基本调用 + debug 可观测** demo。

它不是 Lesson 1 完整完成版。session、context window、hooks、permission、memory 都还没有真正实现。当前代码的价值是让学习者先掌握 runtime skeleton、provider boundary、tool registry，然后看到 agent loop 的最小闭环：

```text
user message
  -> build minimal context
  -> provider request
  -> provider event
  -> optional tool call
  -> tool result message
  -> next provider request
  -> stop reason
  -> debug logs
```

tag 名称：

```text
lesson1-agent-loop-basic-debug
```

## 当前实现覆盖的小节

| 小节 | 覆盖程度 | 说明 |
| --- | --- | --- |
| 1.1 Runtime skeleton | learning complete in `lesson1-agent-loop-basic-debug` | runtime package、测试、类型目录可用。 |
| 1.2 ModelProvider boundary | learning complete in `lesson1-agent-loop-basic-debug` | 已有 provider contract、OpenAI-compatible provider、MIMO resolver，足够学习 provider boundary。 |
| 1.3 ToolRegistry | learning complete in `lesson1-agent-loop-basic-debug` | `echo_tool` 和 registry 足够学习 tool call 回填。 |
| 1.4 HookRunner | not implemented | 没有真实 hook pipeline。 |
| 1.5 Context / session / memory / permission | not implemented as capability | context/session 只是最小 stub；context window、persistence、memory、permission 未实现。 |
| 1.6 AgentLoop | partial in `lesson1-agent-loop-basic-debug` | basic call path 已跑通，用于支撑 demo；完整状态机后续继续补。 |
| 1.7 Demo / debug | partial in `lesson1-agent-loop-basic-debug` | demo 可观察调用过程、传参、返回和单次 token usage。 |

后续每次增强，都要在文档里说明新增能力属于哪个 lesson 小节，并记录对应 tag。

## 关键文件

`packages/agent-runtime/src/core/agent-loop.ts`
- `AgentLoop.runTurn()` 是当前核心。
- 负责构建最小 request、消费 provider events、执行 tool、回填 tool result、决定 stop reason。

`packages/agent-runtime/src/providers/openai-compatible-provider.ts`
- 使用 OpenAI SDK 调用 OpenAI-compatible 平台。
- 把 SDK response 转成 Fate AI 内部 `ModelEvent`。
- 缓存 SDK client，避免一次运行重复创建。

`packages/agent-runtime/src/providers/openai-compatible-provider-factory.ts`
- 从 env 读取 API key。
- 缺 key 时返回 `missing_api_key`，不吞掉错误。

`packages/agent-runtime/src/providers/provider-resolver.ts`
- 从 role 解析 model 和 provider。
- 使用 `providerType` 参数选择 provider 创建逻辑，不使用 callback 隐藏主流程。

`packages/agent-runtime/src/config/mimo-agent-config.ts`
- 提供当前阶段的 MIMO OpenAI-compatible 配置选项。
- MIMO 是当前阶段使用的平台选项，不是产品默认配置。

`packages/agent-runtime/src/tools/tool-registry.ts`
- 根据 tool name 执行注册的 tool。
- 未知 tool 返回 recoverable error。

`packages/agent-runtime/src/tools/echo-tool.ts`
- 当前唯一 tool，用于验证 tool call -> tool result -> next provider request。

`packages/agent-runtime/src/context/context-builder.ts`
- 当前只是最小 context builder。
- 还没有 context window、AGENTS.md section、include / exclude、memory selection。

`packages/agent-runtime/src/session/in-memory-session-store.ts`
- 当前只是内存 event append/list。
- 还不是 session persistence。

`packages/agent-runtime/src/demo/run-demo.ts`
- 串起 MIMO OpenAI-compatible provider path。
- 显式开启 `DEBUG = true`。

`packages/agent-runtime/src/demo/utils/debug-model-provider.ts`
- 包装 provider，打印每次 `createMessage` 的 request、event、duration 和 usage。

`packages/agent-runtime/src/demo/utils/debug-session-store.ts`
- 包装 session store，实时打印 agent events。

`packages/agent-runtime/src/demo/utils/debug-logger.ts`
- 统一日志格式：`HH:mm:ss sss[group][step] message`。
- 使用 `chalk` 给日志加颜色。

## 实际执行路径

MIMO demo：

```text
bun run demo
  -> createMimoAgentConfig()
  -> resolveProviderForRole()
  -> createOpenAICompatibleProviderFromEnv()
  -> OpenAICompatibleModelProvider.createMessage()
  -> OpenAI SDK chat.completions.create()
  -> ModelEvent stream or provider_error
```

## DEBUG 日志证明了什么

日志可以看到：

- provider 选择过程。
- agent profile。
- 每次 provider request 的完整 `ModelRequest`。
- provider 返回的每个 `ModelEvent`。
- tool call 输入。
- tool result。
- 每次 provider call 的 `durationMs`、`eventCount`、`stopReason`、`usage`。
- 最终 `RunTurnResult`。

示例：

```text
10:39:04 052[provider][usage] finish message #0
{
  "callId": 0,
  "durationMs": 0,
  "eventCount": 2,
  "stopReason": "tool_use",
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0,
    "totalTokens": 0
  }
}
```

## 测试覆盖

当前测试覆盖：

- provider request 到 OpenAI-compatible params 的映射。
- OpenAI response 到 `ModelEvent` 的映射。
- provider resolver 的 role fallback、model fallback、missing API key error。
- tool registry 执行和 unknown tool error。
- agent loop 一次 tool call 后结束。
- agent loop 超过 `maxIterations` 后停止。
- MIMO config shape。

当前测试还没有覆盖：

- HookRunner 真实顺序。
- permission block。
- session persistence restore。
- context window 编辑。
- memory selection。
- file / shell / git tools。

## 验证结果

已验证命令：

```bash
cd packages/agent-runtime
bun run check
bun run typecheck
bun test
bun run demo
```

当前环境下 `bun run demo` 可能因为网络限制返回 provider `Connection error.`。这说明 MIMO provider path 已经走到真实网络请求边界。

## 下一步

下一组 tag 不应该继续堆 demo，而应该补 Lesson 1 没完成的基础能力，建议顺序：

1. HookRunner pipeline 接入 agent loop。
2. Context sections 和 AGENTS.md project instructions。
3. Session persistence 的 JSONL MVP。
4. PermissionGate 最小 check。
5. MemoryStore stub 到可测试实现。
