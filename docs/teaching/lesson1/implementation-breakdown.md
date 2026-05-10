# Lesson 1 实现拆解

## 使用方式

这个文件只在真实代码实现和运行验证后填写。它不能提前写成想象中的总结，必须基于实际文件、实际代码路径、实际测试结果和 demo 输出。

实现完成后，本文件应该让用户能快速理解：

- 实际新增和修改了哪些文件。
- 每个核心模块负责什么。
- agent loop 的真实执行路径。
- provider、tool、hook、context、session 之间如何协作。
- 测试覆盖了哪些行为。
- demo 输出证明了什么。
- 哪些部分仍是 MVP 简化版。


## 小节拆解索引

实现完成后，按同一套 Lesson 1 小节编号填写拆解。

### Lesson 1.1 Runtime skeleton, package layout, and baseline tooling

状态：in progress

待实现完成后补充真实文件和运行结果。

### Lesson 1.2 ModelProvider, prompt contracts, and provider transport boundary

状态：in progress

已先完成 prompt contract 和默认 role prompt 的真实代码：

- `packages/agent-runtime/src/types/prompt.type.ts`
- `packages/agent-runtime/src/types/agent.type.ts`
- `packages/agent-runtime/src/prompts/default-agent-role-prompts.ts`
- `packages/agent-runtime/tests/agent-profile.test.ts`

当前结果：

- `AgentProfile` 已显式引用 `systemPrompt`。
- `PromptTemplate`、`SystemPromptRef`、`AgentRolePrompt`、`PromptStore` 已进入类型目录。
- 默认 `coder`、`oracle`、`reviewer`、`explorer` prompt 已建立。
- 默认 prompt 采用 Amp Code system prompt 的映射策略：能对应 Fate AI 的直接使用，不能对应的改成 Fate AI runtime 语义。
- provider / transport / resolver 代码还未实现。

已验证：

- `bun run typecheck`
- `bun run test`
- `bun run check`

### Lesson 1.3 ToolRegistry and first mock tool

状态：not started

待实现完成后补充真实文件和运行结果。

### Lesson 1.4 HookRunner MVP

状态：not started

待实现完成后补充真实文件和运行结果。

### Lesson 1.5 Context, prompt, memory, session, and permission stubs

状态：not started

待实现完成后补充真实文件和运行结果。

### Lesson 1.6 AgentLoop MVP state machine and stop reasons

状态：not started

待实现完成后补充真实文件和运行结果。

### Lesson 1.7 CLI demo, verification, teaching notes, and implementation breakdown

状态：not started

待实现完成后补充真实文件和运行结果。

## 实现概览

状态：not started

待实现后填写。

## 文件清单

待实现后填写。

建议格式：

```text
packages/agent-runtime/src/core/agent-loop.ts
- 负责 ...

packages/agent-runtime/src/providers/provider-transport.ts
- 负责 ...

packages/agent-runtime/src/providers/model-provider-proxy.ts
- 负责 ...
```

## Agent Loop 执行路径

待实现后填写。

建议格式：

```text
runTurn()
  -> hookRunner.run("BeforeContextBuild")
  -> contextBuilder.build()
  -> provider.createMessage()
  -> toolRegistry.execute()
  -> provider.createMessage()
  -> hookRunner.run("Stop")
  -> sessionStore.append()
```

## 关键代码讲解

待实现后填写。

每段讲解要包含：

- 代码位置。
- 这段代码解决什么问题。
- 为什么这样实现。
- 现在的简化点。
- 后续扩展点。

## 运行结果

待实现后填写。

必须包含：

- typecheck 结果。
- test 结果。
- demo 命令。
- demo 输出摘要。

## 测试覆盖

待实现后填写。

至少说明：

- 无 tool call 的停止路径。
- 一次 tool call 后停止路径。
- `max_iterations`。
- provider error。
- user interrupt。
- hook block。

## MVP 简化点

待实现后填写。

候选项：

- Mock transport 拦截真实 provider 请求边界，替代真实网络请求。
- `echo_tool` 替代 file tools。
- In-memory session store 替代真实 persistence。
- 粗略 token estimate。
- 内部 typed hooks，暂不开放脚本。

## 下一课衔接

待实现后填写。

说明 Lesson 2 会如何基于 Lesson 1 扩展真实 provider adapter 和多模型 agent profile。
