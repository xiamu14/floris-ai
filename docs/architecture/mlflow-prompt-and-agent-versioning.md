# MLflow Prompt And Agent Versioning

## 目标

MLflow UI 里有 `Prompts` 和 `Agent versions`，这和 Floris 后续的 PromptManager、AgentProfile、AgentVersion 很接近。结论是：可以接入，而且值得接入；但 MLflow 不应该成为 Floris 的唯一配置中心。

推荐关系：

```text
Floris PromptManager / AgentVersion
  -> source of truth
  -> typed runtime contract
  -> local/offline/app bundled behavior

MLflow Prompt Registry / Agent versions
  -> registry mirror
  -> trace lineage
  -> version comparison
  -> eval and experiment UI
```

## 为什么不完全迁移到 MLflow

Floris 第一阶段是 macOS desktop app，本地 runtime 必须在没有 MLflow server、没有网络、没有实验平台的情况下正常工作。Prompt 和 agent 配置属于 runtime contract，不能只存在外部 observability 平台里。

Floris 的 agent version 也不只是 prompt 文本。一个可运行 agent 至少包含：

- system prompt version。
- tool scope version。
- model policy version。
- context policy version。
- memory policy version。
- stop policy version。
- permission policy version。
- runtime version。
- git sha 或 build id。

MLflow Prompt Registry 更适合管理 prompt template、版本、alias、trace linkage 和 eval 对比。它不应该接管 Floris 的权限边界、tool scope、context selection 和本地运行语义。

## Source Of Truth

Floris 内部仍然维护本地 typed contract：

```text
packages/agent-runtime/src/prompts/
packages/agent-runtime/src/agents/
packages/agent-runtime/src/types/prompt.type.ts
packages/agent-runtime/src/types/agent.type.ts
```

后续建议新增：

```text
packages/agent-runtime/src/types/agent-version.type.ts
packages/agent-runtime/src/agents/agent-version.ts
packages/agent-runtime/src/prompts/prompt-manager.ts
packages/agent-runtime/src/trace/mlflow-prompt-registry.ts
```

本地 contract 负责：

- 默认 prompt 和 agent profile 随 app 分发。
- 本地开发和测试稳定运行。
- offline fallback。
- schema validation。
- prompt variable contract。
- agent role 到 model/tool/context policy 的组合。

MLflow 负责：

- 注册 prompt version。
- 给 prompt 设置 alias，例如 `production`、`candidate`、`lesson-1-3`。
- 把 trace 关联到 prompt version 和 agent version。
- 对比不同 prompt / agent version 的 trace、usage、latency、success rate。
- 支持 benchmark / eval 查看版本变化影响。

## Floris Agent Version

建议 `AgentVersion` 是 Floris 内部稳定对象，不直接等同于 MLflow agent version：

```ts
interface AgentVersion {
  id: string;
  agentId: string;
  promptVersion: string;
  toolScopeVersion: string;
  modelPolicyVersion: string;
  contextPolicyVersion: string;
  memoryPolicyVersion: string;
  stopPolicyVersion: string;
  permissionPolicyVersion: string;
  runtimeVersion: string;
  gitSha?: string;
  createdAt: string;
}
```

每次 agent run 应写入 trace attributes：

```text
floris.agent_id
floris.agent_version
floris.prompt_id
floris.prompt_version
floris.tool_scope_version
floris.model_policy_version
floris.context_policy_version
floris.runtime_version
floris.git_sha
```

这些字段要进入 MLflow trace，即使没有启用 MLflow Prompt Registry，也应该可见。

## Prompt Registry Mirror

后续可以把 Floris prompt 同步到 MLflow Prompt Registry：

```text
Floris prompt id: agent.coder.system
Floris prompt version: 2026-05-17.lesson1
MLflow prompt URI: prompts:/agent.coder.system/2026-05-17.lesson1
```

运行时流程：

```text
PromptManager resolves local prompt
  -> builds final system prompt with variables
  -> records floris.prompt_id and floris.prompt_version
  -> optional: registers / links MLflow prompt version
  -> AgentLoop starts trace with prompt metadata
```

不要让 runtime 每次运行都依赖 MLflow 拉 prompt。MLflow prompt 可以用于实验加载，但进入正式 Floris 默认配置前，必须同步回 repo 或本地 prompt store。

## Agent Version Change Breakout

Agent version change breakout 用来解释“为什么这次 agent 行为变了”。它应该先由 Floris 生成，再写入 MLflow。

建议 breakout 内容：

```text
AgentVersionChange
  fromVersion
  toVersion
  changedSections:
    - prompt
    - toolScope
    - modelPolicy
    - contextPolicy
    - stopPolicy
  humanSummary
  expectedBehaviorChange
  riskNotes
  benchmarkIds
```

MLflow 中可以用：

- prompt version description。
- agent version metadata。
- trace tags / attributes。
- evaluation run notes。

但 breakout 的原始结构仍然归 Floris 管理，方便 macOS app、session history、handoff 和 benchmark runner 都能读取。

## 和 Benchmark 的关系

Prompt / agent version 管理必须和 benchmark 一起设计，否则版本变更只剩主观观察。

推荐最小闭环：

```text
change prompt or agent policy
  -> create AgentVersion
  -> run benchmark cases
  -> write traces with floris.agent_version
  -> compare usage / stop reason / tool calls / answer quality
  -> promote alias in MLflow only after benchmark accepted
```

第一批 benchmark 可以断言：

- stop reason。
- tool call sequence。
- total usage。
- context truncation。
- final answer length。
- known facts present。
- provider error / max_tokens count。

## 当前阶段边界

现在只先记录架构结论，不马上实现 MLflow Prompt Registry 写入。

当前可以先做的最小实现：

- 在 trace root span 增加 `floris.prompt_id`、`floris.prompt_version`。
- 在 trace root span 增加 `floris.agent_version`。
- 在 demo 中使用固定 lesson version。
- 后续 PromptManager 落地后，再接 MLflow Prompt Registry mirror。

暂不做：

- 不把 MLflow UI 当成 Floris prompt 编辑器。
- 不让 runtime 必须从 MLflow 拉 prompt 才能运行。
- 不把 MLflow agent version 当成 Floris agent version 的唯一 ID。
- 不把 secret、API key、credential 写入 prompt registry 或 trace。
