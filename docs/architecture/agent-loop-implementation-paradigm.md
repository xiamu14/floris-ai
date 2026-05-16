# Agent Loop 实现范式

## 目标

本文档定义 Floris AI agent runtime，尤其是 `agent-loop.ts` 相关代码的实现范式。它用于约束后续实现方式，避免 agent loop 演变成难测试、难扩展的大型 class 或混乱的流程脚本。

结论：Floris AI 采用 **data-driven + event-driven 的 TypeScript 风格**，核心状态机尽量函数式，外部依赖使用 interface 边界。

## 参考对比

### Pi

Pi 更接近 TypeScript 模块化 runtime：

- core 保持小。
- provider、tools、extensions、skills 都是可插拔模块。
- session 使用 JSONL 和 tree structure 表达历史。
- `AgentSession` 这类对象负责组织一次运行中的状态。

Pi 的启发不是使用传统继承，而是：

- 数据结构清楚。
- session/event 可恢复。
- 能力通过模块和 extension 注入。
- 核心 runtime 不关心具体 provider 和具体工具实现。

### Claude Code

Claude Code 的 hooks 暴露出明显的 event lifecycle：

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `PreCompact`

它的关键启发是：agent runtime 不应该靠 subclass override 控制流程，而应该通过稳定的 typed events 和 hook result 控制流程。

例如：

- `PreToolUse` 可以阻止工具执行。
- `Stop` 可以阻止 agent 过早停止。
- `UserPromptSubmit` 可以注入上下文或阻止用户输入。

Floris AI 采用同类思路，但第一阶段先做内部 typed hooks，不开放用户脚本。

## 总体范式

不同部分采用不同范式：

```text
AgentLoop
- 函数式状态机为主
- 小 class 可以作为 dependencies wrapper
- 核心逻辑拆成可测试函数

Provider / Tool / Store / HookRunner
- interface 边界
- 对象式 service 实现
- 隔离 IO、副作用和外部依赖

ContextBuilder / reducers / event conversion
- pure function 优先
- 输入数据，输出新数据

AgentProfile / AgentEvent / Message / ToolCall
- plain object
- discriminated union
- 不使用继承表达业务差异
- 类型定义集中在 `packages/agent-runtime/src/types/*.type.ts`
```

## 类型集中管理

`packages/agent-runtime` 的类型必须独立目录和独立文件管理。实现文件只写运行时代码，不直接定义命名类型。

要求：

- 所有 `type`、`interface`、discriminated union、复杂泛型工具类型都放在 `packages/agent-runtime/src/types/`。
- 类型文件命名为 `xxx.type.ts`。
- 实现文件使用 `import type` 引入类型。
- `agent-loop.ts` 不能定义 `AgentProfile`、`LoopState`、`RunTurnInput`、`RunTurnResult`、`LoopStopReason` 等类型。
- provider、tool、hook、context、session、permission 相关 contract 都先进入对应 `.type.ts` 文件。
- 类型文件不能包含运行时代码。

## frameworkContext 处理横切依赖

随着 provider compatibility、tool artifact store、token estimator、permission gate、logger 等横切依赖增加，单纯逐级传参会让函数签名膨胀，也容易漏传字段。

Floris runtime 引入 `frameworkContext` 作为 typed context 机制。它不是全局 singleton，也不是大业务状态对象。每次 run / request / tool call 显式创建 context，再按场景派生小 context，例如 `ToolExecutionContext`、`ProviderRequestContext`、`HookExecutionContext`。

完整设计见 `docs/architecture/framework-context.md`。

## Agent 差异用数据表达

不要用 subclass 表达不同 agent：

```ts
class CoderAgent extends BaseAgent {}
class OracleAgent extends BaseAgent {}
class ReviewerAgent extends BaseAgent {}
```

这种做法会导致 agent loop、context、permissions、hooks 随着 agent 类型分叉。

推荐用 `AgentProfile`：

```ts
type AgentProfile = {
  id: string;
  displayName: string;
  role: "coder" | "oracle" | "reviewer" | "explorer";
  systemPrompt: SystemPromptRef;
  model: ModelRef;
  allowedTools: string[];
  contextPolicy: ContextPolicy;
  stopPolicy: StopPolicy;
  writeAccess: "none" | "workspace" | "limited";
};
```

同一个 `AgentLoop` 读取不同 profile：

```ts
await agentLoop.runTurn({
  profile: coderProfile,
  threadId,
  branchId,
  userMessage,
  signal,
});
```

## AgentLoop 形态

`AgentLoop` 可以是一个小 class，但只能负责装配 dependencies 和暴露 API。核心流程应放在函数里。

推荐：

```ts
export class AgentLoop {
  constructor(private readonly deps: AgentLoopDeps) {}

  runTurn(input: RunTurnInput): Promise<RunTurnResult> {
    return runAgentTurn(this.deps, input);
  }
}

export async function runAgentTurn(
  deps: AgentLoopDeps,
  input: RunTurnInput
): Promise<RunTurnResult> {
  // state machine lives here
}
```

不推荐：

```ts
class AgentLoop {
  private messages = [];
  private currentToolCalls = [];
  private tokenUsage = 0;

  private async buildPrompt() {}
  private async callProvider() {}
  private async executeTools() {}
  private async maybeStop() {}
}
```

原因：

- mutable fields 会让测试依赖执行顺序。
- 中断和恢复更难处理。
- 多 branch / 多 window 会更容易共享错误状态。
- event replay 不清楚。

## LoopState 要显式

agent loop 的内部状态应该是显式数据：

```ts
type LoopState = {
  threadId: string;
  branchId: string;
  iteration: number;
  messages: AgentMessage[];
  pendingToolCalls: ToolCall[];
  events: AgentEvent[];
  usage: TokenUsage;
  stopReason?: LoopStopReason;
};
```

状态更新尽量通过函数：

```ts
function appendModelEvent(state: LoopState, event: ModelEvent): LoopState;
function appendToolResult(state: LoopState, result: ToolResult): LoopState;
function resolveStopReason(state: LoopState): LoopStopReason | undefined;
function shouldContinueLoop(state: LoopState, limits: LoopLimits): boolean;
```

这样可以单独测试每个状态转换。

## Event 是 runtime 的主输出

所有重要动作都要转成 `AgentEvent`：

- user message accepted
- context built
- model request started
- model text delta
- model tool call
- tool started
- tool finished
- hook started
- hook finished
- permission decision
- stop reason
- user interrupt

UI、session persistence、debug、teaching notes 都应该消费 event，而不是读取 agent loop 内部字段。

## Hooks 是 typed pipeline

Hooks 不使用继承覆写。HookRunner 接收 event name 和 payload，返回 typed result。

推荐：

```ts
type HookResult =
  | { kind: "continue" }
  | { kind: "block"; reason: string }
  | { kind: "add_context"; content: string }
  | { kind: "request_user_approval"; reason: string };
```

不同 hook event 可以收窄自己的 result 类型。比如：

- `PreToolUse` 可以 `continue`、`block`、`request_user_approval`。
- `Stop` 可以 `continue` 或 `block`，block 表示让 agent 继续。
- `UserInterrupt` 只能做记录和清理，不能阻止中断。

## Provider 只通过 ModelProvider 进入 loop

agent loop 不能直接调用具体 SDK，学习和 demo 路径也不使用替代真实模型调用的 provider。

允许：

```ts
deps.provider.createMessage(request, signal)
```

不允许：

```ts
deps.openai.responses.create(...)
deps.anthropic.messages.create(...)
```

测试如果需要本地 test double，只能放在测试文件内部，不能进入 runtime source、demo 或 lesson 学习路径。

## Tools 通过 ToolRegistry 执行

agent loop 不 import 具体 tool。

允许：

```ts
deps.toolRegistry.execute(toolCall, context)
```

不允许：

```ts
readFileTool.execute(...)
echoTool(...)
```

原因：

- 不同 agent 有不同 tool scope。
- permission gate 要统一处理。
- tool result 要统一写 event。

## ContextBuilder 保持可解释

ContextBuilder 不应该直接返回一个大字符串。它应该返回 section 列表：

```ts
type ContextSection = {
  kind: "system" | "project_instructions" | "memory" | "recent_messages" | "tool_results";
  title: string;
  content: string;
  tokenEstimate: number;
  source?: string;
};
```

这样后续 Context Inspector 可以直接展示每个 section，也方便用户 include / exclude。

## 错误处理

不要用 throw 控制正常业务分支。以下情况应该转成 structured result：

- unknown tool
- permission denied
- provider returned tool call with invalid input
- context limit reached
- stop hook blocked

只有真正的程序错误才 throw，比如 invariant 被破坏或依赖未初始化。

## 测试策略

必须优先测试这些内容：

- pure state transition functions。
- `runAgentTurn()` event sequence。
- provider error 转成 `provider_error`。
- user interrupt 转成 `user_interrupted`。
- tool call path。
- max iteration path。
- hook block path。

测试不应该依赖真实 provider 或真实文件系统，除非当前 lesson 明确在实现 file tools。

## 修改规则

涉及以下文件或模块时，必须先阅读本文档：

- `packages/agent-runtime/src/core/agent-loop.ts`
- `packages/agent-runtime/src/core/*loop*`
- `packages/agent-runtime/src/hooks/*`
- `packages/agent-runtime/src/providers/model-provider.ts`
- `packages/agent-runtime/src/context/context-builder.ts`
- `packages/agent-runtime/src/session/*`

如果实现需要违反本文档，必须先在设计文档或计划文档里说明原因、影响和替代方案。
