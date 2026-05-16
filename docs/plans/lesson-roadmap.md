# Lesson Roadmap

## 目标

这个文档记录 Lesson 1 之后的课程大章节方向。当前只有 Lesson 1 有完整计划和教学文档，Lesson 2 之后还没有展开到同等粒度。

后续章节按“实现能力完整度”组织，而不是按单个技术模块拆分。这样每一章都能交付一段可运行、可讲解、可验证的 agent 能力链。

## 章节总览

| Lesson | 主题 | 目标 |
| --- | --- | --- |
| Lesson 1 | MVP Agent Loop | 浅实现 provider、prompt、tool registry、hooks、context、session、agent loop 和 demo，建立基础框架和编程范式。 |
| Lesson 2 | Coding Agent Core | 补齐接近 Amp / Claude Code 的单 agent coding 能力：真实 coding tools、tool output optimization、tool scope、provider / model policy、permission 和 sandbox runtime protocol。 |
| Lesson 3 | Persistent Work Graph | 把一次 run 升级成可恢复、可分支、可同步的工作系统：session persistence、thread / branch tree、event replay、context snapshot、workspace relocate、session sync 基础。 |
| Lesson 4 | Context and Memory System | 让 context、token 和 memory 可查看、可裁剪、可编辑：Context Inspector、trimming、compaction、manual summary、Memory Library、memory selection。 |
| Lesson 5 | Extension and Integration Layer | 从 fixed coding agent 走向通用 agent platform：skills、prompt templates、MCP tools、plugin tool contract、tool catalog、extension permission metadata。 |
| Lesson 6 | Multi-Agent Collaboration | 用 Floris 的 multi-agent 替代隐藏 subagent：多个 agent role 共享 work graph，可跨 session 补充 context、协作沟通，并为多窗口 UI 预留状态模型。 |
| Lesson 7 | Product Shell and UI | 把 runtime 能力产品化：desktop UI 或 web UI、chat thread、approval UI、sandbox UX、Context Inspector UI、Memory Library UI、branch UI、multi-agent 多窗口 UI、runtime bridge。 |

## Lesson 1 的定位

Lesson 1 是 MVP，不追求完整产品能力。它的价值是让主要抽象都先出现一层浅实现：

- runtime package 和目录组织。
- TypeScript 类型管理规则。
- provider boundary。
- prompt / agent profile contract。
- tool registry。
- hook runner 位置。
- context builder 位置。
- memory / session stub。
- permission gate 位置。
- agent loop 状态机。
- 可运行 demo 和 debug event。

后续所有章节都基于 Lesson 1 的框架继续加深。如果后续实现发现 Lesson 1 的抽象不够，也可以调整，但调整必须同步文档说明原因。

## Lesson 2 的定位

Lesson 2 目标是把 MVP agent loop 变成一个可用的单 agent coding runtime。

它不是只做 provider，也不是只做 tools。它应该打通一条完整 coding 执行链：

```text
agent profile / model policy
  -> active tool scope
  -> real coding tool call
  -> permission runtime decision
  -> sandbox policy
  -> tool execution
  -> two-layer output filtering
  -> optimized tool result back to model
```

Lesson 2 可以先不做完整 UI approval，但 runtime 必须能表达：

- `PermissionRequest`
- `PermissionDecision`
- `needsUserApproval`
- tool risk metadata
- sandbox policy
- raw artifact / rawRef
- token metrics

UI approval 和 sandbox UX 在 Lesson 7 做产品化，但协议和事件不能等到 UI 阶段才设计。

### Lesson 2 小节概要

#### 2.1 Workspace understanding

能力结果：Floris 能自己浏览项目结构、读取相关文件、搜索代码，而不是依赖用户贴代码。

工程实现：`list_files`、`read_file`、`search_files`、ignore rules、path boundary、file size / line limits。

验收信号：给一个陌生小 repo，agent 能先列目录，再读 README / package metadata / source files，最后总结项目功能。

#### 2.2 Workspace editing

能力结果：Floris 能通过 patch 修改 workspace，并解释改了哪些文件。

工程实现：`apply_patch`、patch validation、changed files summary、write risk metadata、diff artifact。

验收信号：agent 完成一个小 bugfix，event log 记录 patch、changed files 和修改摘要。

#### 2.3 Local verification

能力结果：Floris 能运行 test / lint / typecheck / build，并基于真实输出继续修复或确认完成。

工程实现：`run_command`、`run_task`、command classifier、timeout、exit code、stdout / stderr filter、long-running command 状态。

验收信号：agent 修改代码后主动运行验证；失败时能读取错误重点并继续修。

#### 2.4 Repository awareness

能力结果：Floris 能理解 git 工作区状态和 diff 范围，避免误报、漏报或覆盖用户改动。

工程实现：`git_status`、`git_diff`、porcelain parser、diff summary、scoped diff、changed file risk metadata。

验收信号：最终回答能列出 changed files、diff 摘要和验证结果。

#### 2.5 HTTP smoke testing

能力结果：Floris 能检查本地服务或 API response，用于自动化 smoke test 和调试。

工程实现：`http_request`、method / domain policy、content-type summary、header redaction、body cap、raw response artifact。

验收信号：agent 能对本地 endpoint 做 GET smoke test，并只把 status、headers 摘要和 body 摘要带回 context。

#### 2.6 Token-aware tool output

能力结果：Floris 不会把大日志、大 diff、大 HTTP response 直接塞进 context，同时仍保留完整 raw output 可追溯。

工程实现：`ToolResultEnvelope`、artifact store、rawRef、tool domain filter、runtime `ToolResultPolicy`、token metrics、omitted sections。

验收信号：tool event 展示 raw token、context token、reduction ratio、filter strategy 和 rawRef。

#### 2.7 Tool scope control

能力结果：Floris 不会把所有 tools 默认暴露给模型，而是按 agent profile / task mode 选择本轮可见 tools。

工程实现：active tool scope、agent profile allowed tools、task mode tool preset、tool definition budget。

验收信号：不同 demo / agent profile 的 provider request 携带不同 tool definitions。

#### 2.8 Safe execution runtime protocol

能力结果：Floris 能表达某个 tool call 是自动允许、拒绝，还是需要用户确认，为 UI approval 做准备。

工程实现：`PermissionRequest`、`PermissionDecision`、`allow / deny / ask`、risk metadata、sandbox policy、permission event。

验收信号：高风险 command / write / network action 不直接执行，event log 出现 `needsUserApproval` 或 deny reason。

#### 2.9 Provider and model policy hardening

能力结果：Floris 能按 agent role 选择合适 model，并在 provider 出错时给出可诊断错误或 fallback。

工程实现：多 provider config、多 model config、role-based model policy、fallback、provider compatibility、structured provider errors。

验收信号：切换 role 或 provider config 时，agent 使用正确 model；provider error 保留 status、param、request id 和 details。

## Lesson 3 的定位

Lesson 3 解决 Floris 的工作记录和协作地基。

Agent 不应该只是一次函数调用，而应该在可恢复的 work graph 上工作：

- thread。
- branch。
- entry。
- tool call。
- tool result。
- context snapshot。
- permission decision。
- agent invocation。
- workspace path snapshot。

这一章是后续 multi-agent 的基础。没有 persistent work graph，不同 agent 只能各自对话，不能稳定共享事实、补充 context、比较结果或在不同窗口里协作。

### Lesson 3 小节概要

#### 3.1 Project continuity

能力结果：Floris 能识别“这是同一个项目”，即使 workspace path 发生迁移，也不丢失历史 thread 和 memory。

工程实现：`Project` stable id、workspace path snapshot、previous paths、git remote / commit / fingerprint、relocate flow contract。

验收信号：移动项目目录后，历史 thread 仍能解析相对路径并提示 workspace relocate。

#### 3.2 Durable conversation history

能力结果：Floris 的 message、tool call、tool result 和 agent event 不再只存在内存里，可以恢复和回放。

工程实现：`Thread`、`Entry`、message entry、tool call entry、tool result entry、append-only event log、storage schema。

验收信号：重启 runtime 后能恢复 thread，并展示之前的 tool 调用和结果摘要。

#### 3.3 Visible branch exploration

能力结果：用户可以从任意历史点创建 branch，尝试不同方案，并比较结果。

工程实现：`Branch`、`parentBranchId`、`forkedFromEntryId`、branch title、active agent、branch context path。

验收信号：同一 thread 下两个 branch 可以独立继续对话，并记录各自 tool calls 和结论。

#### 3.4 Replayable agent runs

能力结果：Floris 能解释一次 agent run 是怎么发生的，包括用了什么 context、调用了哪些 tools、为什么停止。

工程实现：agent invocation、stop reason、provider request metadata、tool events、permission events、event replay。

验收信号：给定 invocation id，可以重建这次 run 的事件时间线。

#### 3.5 Context snapshot history

能力结果：用户和开发者能看到某次 provider request 实际带了什么，而不是猜模型看到了什么。

工程实现：context snapshot persistence，保存 system、messages、tools、files、memory、summary、token estimate。

验收信号：历史 invocation 可以打开 context snapshot，并看到当时的 sections 和 token estimate。

#### 3.6 Tool and permission audit trail

能力结果：所有真实世界动作都有审计记录，包括原始输出引用、过滤指标和权限决策。

工程实现：tool input / output persistence、rawRef persistence、permission decision persistence、risk metadata persistence。

验收信号：用户能追溯某次文件修改、命令执行或网络请求是谁发起、为什么允许、输出如何被过滤。

#### 3.7 Session sync foundation

能力结果：不同 session 不再完全隔离，agent 可以引用已有 session 的事实、summary、tool result 或决策。

工程实现：session index、cross-session reference、summary reference、file state reference、permission-safe lookup。

验收信号：新 thread 可以引用旧 session 的 summary 或 tool result，而不需要把旧 thread 全量塞进 context。

## Lesson 4 的定位

Lesson 4 解决 context 和 memory。

Context 不是越多越好。Floris 要让用户能看见下一轮 model request 带了什么、为什么带、消耗多少 token，以及哪些内容被省略。

Memory 也不是一个大文本文件，而是分层数据：

- project instructions。
- working memory。
- session summary。
- long-term memory。

这一章要把 token 优化、compaction、manual summary、memory selection 和 Context Inspector 统一起来。

### Lesson 4 小节概要

#### 4.1 Observable context window

能力结果：Floris 能展示下一轮 model request 会带入哪些内容，以及每段内容大概消耗多少 token。

工程实现：context section model、section source、token estimate、context plan。

验收信号：每次 provider request 前都能生成 context plan，包含 system、messages、tools、files、memory 和 summaries。

#### 4.2 User-editable context

能力结果：用户可以临时排除某条 message、tool result、file snippet 或 memory entry，控制模型下一轮看到什么。

工程实现：include / exclude policy、context edit state、entry reference、context build filter。

验收信号：排除某条 tool result 后，下一轮 context snapshot 不再包含它，但历史记录仍然存在。

#### 4.3 Conversation trimming

能力结果：长对话可以从某个点之后继续构建 context，减少旧内容干扰。

工程实现：trim marker、branch context start、history visibility 和 context inclusion 分离。

验收信号：用户设置 trim point 后，旧消息仍可查看，但不进入后续 provider request。

#### 4.4 Automatic compaction

能力结果：thread 过长时，Floris 能把旧上下文压缩成可用 summary，保留任务状态和关键决策。

工程实现：compaction trigger、summary prompt、summary entry、token before / after、recent context retention。

验收信号：达到 budget 后自动生成 session summary，下一轮 request 使用 summary + recent messages。

#### 4.5 Manual summary

能力结果：用户可以修正自动摘要，避免错误 summary 长期污染后续 context。

工程实现：editable summary entry、editedByUser、version history、context builder summary replacement。

验收信号：用户编辑 summary 后，后续 request 使用用户版本，并保留原自动摘要记录。

#### 4.6 Memory Library

能力结果：Floris 的长期信息可查看、可管理、可禁用，不是 agent 私下维护的黑盒。

工程实现：memory entry、scope、type、source、enabled flag、CRUD contract。

验收信号：用户能查看 project instructions、session summaries、long-term memory，并禁用某条 memory。

#### 4.7 Memory selection

能力结果：Floris 能按任务选择少量相关 memory，而不是把所有 memory 都塞进 context。

工程实现：selection policy、scope filter、type filter、recency / relevance scoring、selection reason、token budget。

验收信号：context snapshot 记录选中了哪些 memory、为什么选、消耗多少 token。

#### 4.8 Sensitive data handling

能力结果：secret 不进入 prompt、不出现在 context inspector 明文、不写入长期 memory。

工程实现：secret detection、redaction policy、tool result scan、memory write guard。

验收信号：包含 token-like 内容的 tool result 进入 context 前被脱敏，raw artifact 访问受控。

## Lesson 5 的定位

Lesson 5 解决扩展能力。

Floris 不能只依赖内置 tools。要成为通用 agent platform，需要允许外部能力进入，但不能绕过 runtime 边界。

所有 extension 能力都必须进入统一路径：

```text
extension tool
  -> ToolRegistry
  -> PermissionGate
  -> output filtering
  -> session event
  -> context policy
```

这一章再讨论是否采用 dynamic tool scope negotiation。当前它只是候选方案，不是已决定的产品设计。

### Lesson 5 小节概要

#### 5.1 Extension boundary

能力结果：Floris 能接入外部能力，但外部能力不能绕过 runtime 的安全、日志和 context 规则。

工程实现：extension manifest、lifecycle、capability metadata、registration API。

验收信号：一个本地 extension 可以注册 tool 和 prompt metadata，并出现在 runtime registry。

#### 5.2 Skill loading

能力结果：Floris 能按需加载任务相关 workflow 和说明，不把所有知识写进 system prompt。

工程实现：skill manifest、trigger rules、on-demand loading、skill context section。

验收信号：只有命中任务时，相关 skill 内容才进入 context snapshot。

#### 5.3 Prompt templates

能力结果：不同 agent role 和 task mode 可以复用、版本化、测试 prompt，而不是散落在代码里。

工程实现：prompt template store、version、variables、role / task references。

验收信号：切换 agent role 时，context snapshot 显示对应 prompt template id 和 version。

#### 5.4 MCP integration through Floris runtime

能力结果：Floris 可以使用 MCP tools，但它们和内置 tools 一样走 permission、session 和 output filtering。

工程实现：MCP tool adapter、schema mapping、tool metadata mapping、result envelope adapter。

验收信号：MCP tool call 在 event log 中和 built-in tool 使用同一套 tool started / finished / permission decision 事件。

#### 5.5 Plugin tool contract

能力结果：plugin 可以扩展 Floris 能力，但必须声明风险、输入输出和权限边界。

工程实现：plugin tool schema、capability、risk metadata、input validation、output envelope contract。

验收信号：缺少 risk metadata 的 plugin tool 不能注册或只能以 restricted 模式注册。

#### 5.6 Tool catalog

能力结果：Floris 可以告诉模型有哪些能力可用或可申请，但不需要把全部 tool definitions 一次性放进 context。

工程实现：short tool catalog、active tool scope、tool definition loading policy。

验收信号：provider request 只包含 active tools；catalog 只包含短说明。

#### 5.7 Dynamic tool scope decision

能力结果：团队能基于实际 demo 和 token 数据决定是否实现 `request_tool_access`。

工程实现：设计评估文档、prototype 可选、allow / deny / ask scope flow、scope lifetime model。

验收信号：文档明确采用或暂不采用 dynamic tool scope，并说明原因、代价和后续入口。

#### 5.8 Extension sandbox and packaging

能力结果：外部 extension 可以被安装和运行，但执行边界清楚，可审计、可禁用。

工程实现：local / bundled extension layout、manifest、sandbox rules、network / file boundary、disable flow。

验收信号：安装一个测试 extension 后，可以启用、禁用，并看到它的 tools、权限和执行边界。

## Lesson 6 的定位

Lesson 6 是 Floris 的差异化方向：multi-agent collaboration。

这里不采用 Claude Code / Amp 式隐藏 subagent 作为主设计，而是基于最初的 agent role 模型实现用户可见的 multi-agent：

- `@coder`
- `@oracle`
- `@reviewer`
- `@explorer`

这些 agent 不是只活在自己的 session 里。它们应该能基于 shared work graph 跨 session 补充 context，引用彼此的结果，并通过明确 event 记录协作过程。

未来 UI 上可以用多窗口展示不同 agent 的工作状态。每个 agent 有自己的 model policy、tool scope、context budget 和权限边界，但共享项目事实和工作记录。

### Lesson 6 小节概要

#### 6.1 Visible agent roles

能力结果：用户能明确选择 `@coder`、`@oracle`、`@reviewer`、`@explorer`，每个 agent 有清楚职责。

工程实现：agent role definition、role prompt、model policy、tool scope、write access、context budget。

验收信号：同一输入用不同 agent mention，会使用不同 prompt、tools 和 model policy。

#### 6.2 Agent invocation records

能力结果：每次 agent 工作都可追踪，知道是谁、用什么模型、基于什么 context、调用了哪些 tools。

工程实现：agent invocation entry、agentId、modelId、context snapshot id、tool scope、token usage、status。

验收信号：thread 里每条 agent 输出都能追溯到 invocation 记录。

#### 6.3 Shared work graph

能力结果：多个 agent 不再各聊各的，而是共享项目事实、branch、tool result、permission decision 和 context snapshot。

工程实现：work graph query、agent-scoped views、shared entry references、permission-safe access。

验收信号：`@reviewer` 能引用 `@coder` 的 diff 和验证结果，不需要重新读取全部上下文。

#### 6.4 Cross-session context sync

能力结果：agent 可以跨 session 补充 context，利用历史 session 里的摘要、决策和工具结果。

工程实现：cross-session reference、summary lookup、file state lookup、context import policy。

验收信号：新 session 可以引用旧 session 的结果，并在 context snapshot 中显示来源。

#### 6.5 Agent communication

能力结果：agent 之间可以显式请求 review、探索、计划或结果解释，而不是隐藏后台调用。

工程实现：handoff event、request review event、request exploration event、agent reply reference。

验收信号：`@coder` 可以发起一个可见 review request，`@reviewer` 的结果进入 shared work graph。

#### 6.6 Branch-aware collaboration

能力结果：多 agent 工作绑定到可见 branch，用户知道哪个 agent 在哪个方向上工作，以及是否修改真实 workspace。

工程实现：agent active branch、branch ownership metadata、file edit attribution、branch comparison。

验收信号：两个 agent 可以在不同 branch 上分析或修改，用户能比较分支结果。

#### 6.7 Multi-window state model

能力结果：未来 UI 可以用多个窗口展示不同 agent 的工作状态，而 runtime 状态已经支持。

工程实现：window binding model、agent run state、interrupt state、approval state、context inspector state。

验收信号：runtime 能同时表示多个 agent invocation 的运行、暂停、等待 approval 和完成状态。

#### 6.8 Collaboration context budget

能力结果：一个 agent 的完整过程不会自动污染另一个 agent 的 context，只同步结构化 summary 和引用。

工程实现：collaboration summary、reference passing、context import budget、agent-specific context policy。

验收信号：`@coder` 接收 `@reviewer` 结果时，context 里只有 review summary、风险和引用，不包含 reviewer 全量过程。

## Lesson 7 的定位

Lesson 7 把 runtime 能力变成产品体验。

UI 阶段必须包含：

- chat thread UI。
- tool call 展示。
- raw output 查看。
- permission approval UI。
- sandbox 状态展示。
- permission rules 管理。
- Context Inspector UI。
- Memory Library UI。
- branch UI。
- multi-agent 多窗口 UI。
- runtime bridge。

UI 可以先选 desktop，也可以在后续讨论时评估 web UI。但无论 UI 形态如何，都不能绕过 runtime 的 permission、sandbox、session 和 context contract。

## Permission、MCP、Plugin 和 Hooks 的关系

Permission Request 不应该放进 Lesson 1 实现。Lesson 1 只保留 permission 的位置。

MCP 和 plugin tools 后续也必须走同一套 permission path：

```text
tool call
  -> resolve tool
  -> PermissionGate.check
  -> execute tool
  -> output filtering
  -> session event
```

Permission 不应该依赖 hooks 才能生效。Hooks 是扩展点，适合观察、补充 metadata、提前 block 或记录 telemetry。PermissionGate 是核心安全路径，必须在没有任何 hook 注册时也能工作。

推荐顺序：

```text
PreToolUse hook
  -> PermissionGate.check
  -> ToolRegistry.execute
  -> PostToolUse hook
```

也就是说，hooks 可以参与 permission 相关流程，但不能替代 PermissionGate。
