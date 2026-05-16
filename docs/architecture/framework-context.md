# frameworkContext 架构

## 出现原因

随着 agent runtime 变复杂，很多参数不是单个函数的业务数据，而是贯穿一次 run、一次 provider request 或一次 tool call 的横切依赖。

已经出现的例子：

- `threadId`、`branchId`、`agentId`。
- tool artifact store。
- tool result policy。
- token estimator。
- provider compatibility，例如 MIMO 的 `reasoning_content` 回传要求、tool result message role。
- logger、clock、id generator。
- permission gate、session store。

如果这些参数全部逐级传递，代码会变成：

```text
AgentLoopDeps
  -> AgentLoop
  -> executeToolCall()
  -> ToolRegistry.execute()
  -> Tool.execute()
  -> artifactStore / policy / token estimator
```

Provider path 也会类似：

```text
ProviderConfig
  -> OpenAICompatibleProvider
  -> toOpenAIChatCompletionRequest()
  -> toOpenAIMessages()
  -> compatibility flags
```

这种方式短期清楚，但层级一多会带来三个问题：

- 函数签名膨胀，新增一个横切参数要改很多层。
- 维护时容易漏传，例如 provider-specific `reasoning_content` 这类兼容字段。
- 测试 fixture 需要重复构造一堆无关参数。

我们需要一种类似 React Context 的参数透传机制，但不能引入全局隐式状态。

## 设计目标

`frameworkContext` 是一层上下文机制，不是一个大而全的业务状态对象。

它解决：

1. 统一横切依赖的传递方式。
2. 避免多层函数逐级透传。
3. 让不同场景按需派生小 context。
4. 保持测试可控，每次 run / request / tool call 都能显式创建 context。

它不解决：

- 不保存 messages 列表。
- 不保存 provider result。
- 不保存 pending tool calls。
- 不保存 final answer。
- 不保存大段 file content、command output、HTTP body。

这些仍然是业务数据，应该显式传递或保存为 artifact。

## 核心原则

### frameworkContext 是机制，不是数据仓库

`frameworkContext` 只放稳定横切依赖。

可以放：

- run identity：`threadId`、`branchId`、`agentId`、`projectId`。
- artifact store。
- token estimator。
- output policy。
- provider compatibility。
- logger。
- clock。
- id generator。
- permission gate 引用。
- session store 引用。

不应该放：

- 当前 messages 列表。
- loop iteration。
- pending tool calls。
- model response body。
- final message。
- 大段工具输出。
- 临时局部变量。

判断标准：

> 这个值是不是稳定贯穿一个 run / request / tool call 的横切依赖？如果不是，就不要放进 frameworkContext。

### 不使用全局 singleton

`frameworkContext` 必须显式创建和显式传入入口函数。

不允许：

```ts
const context = globalFrameworkContext.get();
```

允许：

```ts
const frameworkContext = createFrameworkContext()
  .set(runContextKey, run)
  .set(tokenEstimatorKey, tokenEstimator);

await runAgentTurn(deps, input, frameworkContext);
```

### 先派生场景 context，再给业务模块

业务模块不应该到处读取完整 `frameworkContext`。上层应该先按场景派生小 context。

```text
frameworkContext
  -> ToolExecutionContext
  -> ProviderRequestContext
  -> HookExecutionContext
  -> ContextBuildContext
```

Tool 只接收 `ToolExecutionContext`。Provider mapper 只接收 `ProviderRequestContext`。这样能减少透传，同时保留边界。

## 核心抽象

底层可以是 typed key-value context：

```ts
export interface FrameworkContext {
  has<T>(key: FrameworkContextKey<T>): boolean;
  get<T>(key: FrameworkContextKey<T>): T;
  getOptional<T>(key: FrameworkContextKey<T>): T | undefined;
  set<T>(key: FrameworkContextKey<T>, value: T): FrameworkContext;
  pick(keys: FrameworkContextKey<unknown>[]): FrameworkContext;
  describe(): FrameworkContextSnapshot;
}

export interface FrameworkContextKey<T> {
  id: string;
  description: string;
}
```

`set` 返回新的 context，保持 immutable，避免深层模块修改共享对象。

key 集中定义：

```ts
export const runContextKey = createFrameworkContextKey<RunContext>({
  id: "run",
  description: "Current agent run identity.",
});

export const tokenEstimatorKey = createFrameworkContextKey<TokenEstimator>({
  id: "tokenEstimator",
  description: "Token estimation service.",
});

export const toolArtifactStoreKey =
  createFrameworkContextKey<ToolOutputArtifactStore>({
    id: "tool.artifactStore",
    description: "Stores raw tool output artifacts.",
  });
```

## 场景 Context

### ToolExecutionContext

Tool 不需要知道 provider compatibility 或 context builder 细节。它只需要 run identity、artifact store、token estimator、tool policy 等能力。

```ts
export interface ToolExecutionContext {
  run: RunContext;
  artifacts: ToolOutputArtifactStore;
  tokenEstimator: TokenEstimator;
  resultPolicy: ToolResultPolicy;
}

export function createToolExecutionContext(
  frameworkContext: FrameworkContext
): ToolExecutionContext {
  return {
    run: frameworkContext.get(runContextKey),
    artifacts: frameworkContext.get(toolArtifactStoreKey),
    tokenEstimator: frameworkContext.get(tokenEstimatorKey),
    resultPolicy: frameworkContext.get(toolResultPolicyKey),
  };
}
```

Tool 使用：

```ts
await tool.execute(input, toolContext);
```

### ProviderRequestContext

Provider mapper 不应该接收完整 runtime。它只需要 provider request 所需信息：

```ts
export interface ProviderRequestContext {
  modelId: string;
  modelParameters?: ModelParameters;
  compatibility?: OpenAICompatibleProviderCompatibility;
}
```

调用方式：

```ts
toOpenAIChatCompletionRequest(request, providerRequestContext);
```

这样以后新增 provider compatibility 参数，不需要继续拉长函数签名。

### HookExecutionContext

HookRunner 后续可以从 `frameworkContext` 派生 hook 专用 context。

Hook 可以观察：

- run identity。
- session event writer。
- logger。
- permission metadata。
- context budget。

Hook 不应该直接拿完整 tool raw output。需要 raw output 时通过 `rawRef` 读取，避免把大对象塞进 hook payload。

### ContextBuildContext

ContextBuilder 后续可以拿：

- run identity。
- context policy。
- memory selector。
- token estimator。
- artifact summary reader。

但 messages、manual include/exclude、candidate sections 仍然显式传给 builder。

## 使用说明

### 创建 frameworkContext

在 agent loop 入口创建一次：

```ts
const frameworkContext = createFrameworkContext()
  .set(runContextKey, {
    threadId: input.threadId,
    branchId: input.branchId,
    agentId: input.profile.id,
  })
  .set(tokenEstimatorKey, defaultTokenEstimator)
  .set(toolArtifactStoreKey, deps.toolOutputArtifactStore)
  .set(toolResultPolicyKey, deps.toolResultPolicy);
```

### 派生小 context

不要把完整 `frameworkContext` 传进所有模块：

```ts
const toolContext = createToolExecutionContext(frameworkContext);
await deps.toolRegistry.execute(toolCall.name, toolCall.input, toolContext);
```

Provider：

```ts
const providerContext = createProviderRequestContext(frameworkContext, {
  modelId: this.modelId,
  modelParameters: this.modelParameters,
});

toOpenAIChatCompletionRequest(request, providerContext);
```

### 测试

测试可以直接创建需要的场景 context：

```ts
const toolContext = createTestToolExecutionContext({
  threadId: "thread",
  branchId: "branch",
});
```

也可以从 frameworkContext 派生：

```ts
const frameworkContext = createFrameworkContext().set(runContextKey, run);
const toolContext = createToolExecutionContext(frameworkContext);
```

## 和 React Context 的差异

类似点：

- 上层定义，下层按需读取。
- 避免逐级透传。
- 不同执行分支可以有不同 context。

不同点：

- `frameworkContext` 不是全局 ambient context。
- 必须显式传入入口函数。
- 必须 typed。
- 不承载大业务状态。
- 业务模块优先接收场景 context，不直接接收完整 context。

## 文件结构建议

```text
packages/agent-runtime/src/types/
  framework-context.type.ts
  run-context.type.ts

packages/agent-runtime/src/context/
  framework-context.ts
  context-keys.ts
  scenarios/
    tool-execution-context.ts
    provider-request-context.ts
    hook-execution-context.ts
    context-build-context.ts
```

## 实施顺序

第一步先建 frameworkContext 基础设施：

- `createFrameworkContextKey`
- `createFrameworkContext`
- `get`
- `getOptional`
- `set`
- `describe`

第二步迁移已经痛的地方：

- `ToolExecutionContext`：替换当前 `threadId` / `branchId` / `artifactStore` 零散传递。
- `ProviderRequestContext`：替换 `toOpenAIChatCompletionRequest(request, modelId, modelParameters, compatibility)` 这类长参数。

第三步再设计 hook 和 context builder 场景 context。不要为了 frameworkContext 一次性重构所有 runtime。

## 最终原则

> frameworkContext 负责统一横切依赖的传递机制。每个业务场景从中派生小 context。业务数据仍然显式传递。

这样可以减少多层透传带来的维护成本，同时避免把 runtime 变成隐式全局状态。
