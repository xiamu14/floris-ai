# Lesson 1 教学笔记

## 使用方式

这个文件在 Lesson 1 实现过程中同步更新。它不是最终总结，而是每个小节的教学材料。目标是让用户在不看对话记录的情况下，也能按这里的解释独立实现 MVP agent loop。

每个小节完成时，都要补齐：

- 本小节目标。
- 本小节新增文件。
- 核心类型和函数。
- 数据流。
- 为什么这样设计。
- 替代方案。
- 测试说明。
- 常见错误。

小节索引：

- `Lesson 1.1`：Runtime skeleton, package layout, and baseline tooling。
- `Lesson 1.2`：ModelProvider, prompt contracts, and provider transport boundary。
- `Lesson 1.3`：ToolRegistry and first mock tool。
- `Lesson 1.4`：HookRunner MVP。
- `Lesson 1.5`：Context, prompt, memory, session, and permission stubs。
- `Lesson 1.6`：AgentLoop MVP state machine and stop reasons。
- `Lesson 1.7`：CLI demo, verification, teaching notes, and implementation breakdown。

## Lesson 1.1 Runtime 目录结构和基础工具链

状态：in progress

### 目标

建立 Lesson 1 的 TypeScript runtime 工作区，让后续 agent loop、provider、tool、hook、context、memory、session、permission 都有稳定文件位置。

### 新增文件

本轮新增：

- `.gitignore`
- `.zed/settings.json`
- `apps/mac-desktop/README.md`
- `apps/mac-desktop/FateAI/**`
- `apps/mac-desktop/FateAITests/**`
- `packages/agent-runtime/package.json`
- `packages/agent-runtime/bun.lock`
- `packages/agent-runtime/biome.jsonc`
- `packages/agent-runtime/tsconfig.json`
- `packages/agent-runtime/vitest.config.ts`
- `packages/agent-runtime/src/**`
- `packages/agent-runtime/src/types/*.type.ts`
- `packages/agent-runtime/src/prompts/**`
- `packages/agent-runtime/tests/**`
- `docs/architecture/tooling.md`

### 核心类型和函数

本轮只初始化目录和空源码文件，还没有实现完整核心类型。所有类型后续都放在 `packages/agent-runtime/src/types/*.type.ts`，但不会在 1.1 一次写完。每个功能小节先补自己的 contract 类型，再写对应实现。Prompt runtime 预留 `src/prompts`，因为 agent role 的 system prompt 是 MVP agent profile 的一部分。测试文件加入最小 smoke suite，避免 Vitest 因空 test file 失败。

### 数据流

当前还没有 runtime 数据流。目录已经按未来数据流预留：

```text
core
  -> context
  -> providers
  -> tools
  -> hooks
  -> permissions
  -> session
```

### 设计说明

包管理工具使用 Bun。lint / format 使用 Ultracite + Biome，原因记录在 `docs/architecture/tooling.md`。

源码文件先保持空占位，避免在目录初始化阶段提前写业务实现。测试文件不是空文件，因为 Vitest 会把空 test file 视为失败 suite。

### 替代方案

没有选择 npm，因为项目约定改为 Bun。没有选择 Oxlint + Oxfmt 作为默认工具链，因为第一阶段更看重 Ultracite + Biome 与 Zed 的直接集成和配置稳定性。

### 测试说明

已运行：

```bash
bun run typecheck
bun run test
bun run check
```

结果均通过。

### 常见错误

- 空 test file 会导致 Vitest 报 `No test suite found`。
- Ultracite 需要 package 目录内有 ignore 文件，否则 Biome 可能报找不到 ignore file。
- `packages/agent-runtime/biome.jsonc` 继承 Ultracite 时应使用 `ultracite/core`。

## Lesson 1.2 ModelProvider 和 Prompt 最小接口

状态：not started

### 目标

这一小节同时建立 provider 边界和 prompt 边界。原因是 multi-agent 的三个核心输入是 system prompt、model、tools；如果只做 provider，不做 prompt，`AgentProfile` 会缺最关键的 role contract。

本小节要做到：

- `AgentProfile` 明确引用 `systemPrompt`。
- `PromptTemplate`、`SystemPromptRef`、`PromptStore` 进入 `prompt.type.ts`。
- 默认 `coder`、`oracle`、`reviewer`、`explorer` prompt 放进 `src/prompts/default-agent-role-prompts.ts`。
- 默认 prompt 基于 Amp Code system prompt 映射：能对应 Fate AI 的直接使用，不能对应的改写成 Fate AI runtime 语义。
- `ModelProvider` 和 `ProviderTransport` 保持独立，不负责 prompt 管理。

### 新增文件

- `packages/agent-runtime/src/types/prompt.type.ts`
- `packages/agent-runtime/src/prompts/default-agent-role-prompts.ts`
- `packages/agent-runtime/tests/agent-profile.test.ts`

### 核心类型和函数

- `PromptTemplate`：一段可版本化 prompt，包含 `id`、`kind`、`version`、`title`、`content`、`variables`。
- `SystemPromptRef`：`AgentProfile` 对 system prompt 的引用，不直接把 prompt 文本塞进 profile。
- `PromptStore`：后续把默认 prompt、用户编辑 prompt、项目 prompt 统一解析成 `PromptTemplate`。
- `AgentRolePrompt`：默认 role 和 system prompt 的绑定关系。
- `AgentProfile.systemPrompt`：每个 agent profile 必须显式指定 system prompt。

### 数据流

```text
AgentRole
  -> AgentProfile.systemPrompt
  -> PromptStore.getSystemPrompt()
  -> PromptTemplate
  -> ContextBuilder system section
  -> ModelRequest
```

Provider 不参与这条 prompt 解析路径。Provider 只接收已经构建好的 `ModelRequest`。

### 设计说明

Amp prompt 的直接映射分为几类：

- shared principles：`Agency`、`Conventions & Rules`、`AGENTS.md file`、`Context`、`Communication`，进入所有默认 role prompt。
- `coder`：承接 `Task Management`，因为它是默认执行 agent。
- `oracle`：承接 `Oracle`，但 Fate AI 第一阶段用显式 `@oracle` 或 visible handoff，不做隐藏后台 oracle。
- `reviewer`：使用 shared principles，加上 review agent 的 findings-first 约束。
- `explorer`：使用 shared principles，加上 read-only 搜索、路径、符号、关系输出约束。

不直接进入默认 prompt 的内容：

- Amp / Sourcegraph 品牌。
- Amp 专属工具名和 tool JSON schema。
- 查询 Amp 官网的产品说明规则。
- Amp environment 示例。

这些不属于 Fate AI runtime 的稳定语义。

### 替代方案

- 把 prompt 文本直接放在 `AgentProfile` 里：简单，但后续用户编辑、版本管理、Context Inspector 都会变难。
- 把 prompt 交给 provider adapter：错误边界。provider 只负责模型调用，不应该决定 agent role。
- 暂时不做 prompt 管理：会让 multi-agent 后续补设计时推翻 `AgentProfile`。

### 测试说明

- `AgentProfile` fixture 必须显式引用 `systemPrompt`。
- 默认 role prompt 必须覆盖 `coder`、`oracle`、`reviewer`、`explorer`。
- 后续实现 `PromptStore` 时，要测试 unknown prompt ref 返回 typed error，而不是让 context builder crash。

### 常见错误

- 不要把 Fate AI shared prompt 写成“coding agent”。coding 是第一阶段 `coder` 的职责，不是整个产品的永久身份。
- 不要把 Amp 专属工具名写进 Fate AI prompt，除非 runtime 真的提供同名能力。
- 不要在 provider 层硬编码 system prompt。

## Lesson 1.3 ToolRegistry 最小实现

状态：not started

### 目标

待实现后填写。

### 新增文件

待实现后填写。

### 核心类型和函数

待实现后填写。

### 数据流

待实现后填写。

### 设计说明

待实现后填写。

### 替代方案

待实现后填写。

### 测试说明

待实现后填写。

### 常见错误

待实现后填写。

## Lesson 1.4 HookRunner MVP

状态：not started

### 目标

待实现后填写。

### 新增文件

待实现后填写。

### 核心类型和函数

待实现后填写。

### 数据流

待实现后填写。

### 设计说明

待实现后填写。

### 替代方案

待实现后填写。

### 测试说明

待实现后填写。

### 常见错误

待实现后填写。

## Lesson 1.5 Context, prompt, memory, session, and permission stubs

状态：not started

### 目标

把 1.2 定义的 system prompt 接入 context。ContextBuilder 不应该直接拼一个长字符串，而是输出可检查的 sections。

本小节要做到：

- 从 `AgentProfile.systemPrompt` 解析 `PromptTemplate`。
- 把 system prompt 放进独立 `system` context section。
- `AGENTS.md` 进入 `project_instructions` section。
- recent messages、memory entries、tool results 保持独立 section。
- 每个 section 都有 token estimate stub。

### 新增文件

待实现后填写。

### 核心类型和函数

- `ContextSection`：Context Inspector 后续展示的基本单位。
- `ContextBuilder.build()`：接收 profile、messages、memory、tool results、prompt store，输出 sections。
- `PromptStore.getSystemPrompt()`：根据 `SystemPromptRef` 解析 prompt。

### 数据流

```text
RunTurnInput.profile.systemPrompt
  -> PromptStore.getSystemPrompt()
  -> ContextBuilder.build()
  -> [{ kind: "system", content: prompt.content }, ...]
  -> ModelRequest
```

### 设计说明

system prompt 必须是独立 section。原因有三个：

- Context Inspector 需要单独展示 system prompt。
- token 估算需要区分 system、messages、tools、files、memory。
- 后续用户编辑、禁用、版本切换 prompt 时，不能改写原始 thread history。

### 替代方案

- 把 system prompt 拼到第一条 message：实现快，但后续不可查看、不可编辑、不可追踪。
- 每次在 agent loop 里临时拼 prompt：会让 agent loop 变成 prompt 管理器，违反边界。

### 测试说明

- `ContextBuilder` 输出包含 `system` section。
- `system` section 来自 `AgentProfile.systemPrompt` 解析结果。
- 缺失 prompt ref 时返回 typed error 或可记录 event。
- section token estimate 稳定。

### 常见错误

- 不要把 `AGENTS.md` 合并进 system prompt。它是 project instruction section。
- 不要让 provider adapter 读取 prompt store。
- 不要把 secret、API key、credential 放进 prompt section。

## Lesson 1.6 AgentLoop MVP

状态：not started

### 目标

待实现后填写。

### 新增文件

待实现后填写。

### 核心类型和函数

待实现后填写。

### 数据流

待实现后填写。

### 设计说明

待实现后填写。

### 替代方案

待实现后填写。

### 测试说明

待实现后填写。

### 常见错误

待实现后填写。

## Lesson 1.7 Demo, verification, and documentation sync

状态：not started

### 目标

待实现后填写。

### 新增文件

待实现后填写。

### 核心类型和函数

待实现后填写。

### 数据流

待实现后填写。

### 设计说明

待实现后填写。

### 替代方案

待实现后填写。

### 测试说明

待实现后填写。

### 常见错误

待实现后填写。
