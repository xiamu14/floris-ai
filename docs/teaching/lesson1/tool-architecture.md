# Lesson 1.3 Tool Architecture

## 目标

Lesson 1.3 当前只实现了 `echo_tool`，用于教学 tool call 到 tool result 的回填路径。下一步要把它升级成真正支持 general agent 和 coding agent 的 tool layer。

这里的目标不是堆一组能跑的工具，而是建立一套之后所有工具都遵守的 contract：

- 每个 tool 都能被 `ToolRegistry` 统一发现和执行。
- 每个 tool 都返回结构化结果，不直接把大段输出塞进 model context。
- 每个 tool 都能记录 raw output、摘要、token estimate、过滤策略和省略原因。
- 每个 tool 都能接入 permission、session event、Context Inspector 和后续 replay。

随着 tool runtime 增加 artifact store、token estimator、result policy、permission gate 等横切依赖，后续会使用 `frameworkContext` 派生 `ToolExecutionContext`，避免逐层手工传递零散参数。完整设计见 `docs/architecture/framework-context.md`。

## AI Agent 为什么需要 tool

LLM 本身只会基于输入 context 生成文本。它不知道本地文件当前是什么状态，不能真正运行测试，也不能确认修改有没有通过验证。Code agent 的关键差异不是“会写代码”，而是它能通过 tool 把推理连接到真实 workspace。

对 Floris 这样的 desktop code agent，tool 至少解决五类问题：

1. **获取事实**：列目录、读文件、搜索代码、查看 git 状态。没有这些 tool，agent 只能猜项目结构。
2. **执行动作**：修改文件、运行 test / lint / build、发起本地 HTTP smoke test。没有这些 tool，agent 只能给建议，不能完成任务。
3. **验证结果**：运行命令、读取失败日志、比较 diff。没有验证，agent 容易把“看起来合理”的代码当成完成。
4. **建立工作记录**：每次 tool call 都能写入 thread event，用户可以追溯 agent 做了什么、基于什么输出继续推理。
5. **控制风险**：tool 是权限边界。读文件、写文件、跑命令、访问网络都应该经过统一 gate，而不是让 UI 或 provider 绕过 runtime。

### 不同 agent role 对 tool 的需求

第一阶段不做隐藏自动调度，但不同 agent profile 仍然要有不同 tool scope。

| Agent | 主要任务 | 应该拥有的 tool |
| --- | --- | --- |
| `general` | 回答项目问题、解释代码、轻量排查 | `list_files`、`read_file`、`search_files`、`git_status`、`git_diff` |
| `coder` | 修改代码、运行验证、解释改动 | general tools + `apply_patch`、`run_command`、`run_task`、`get_command_output`、`stop_command` |
| `reviewer` | 检查 diff、风险、测试缺口 | `read_file`、`search_files`、`git_status`、`git_diff`，默认不写文件 |
| `explorer` | 快速定位模块和调用关系 | `list_files`、`read_file`、`search_files`，默认不跑高风险 command |
| automation agent | 执行重复检查、API smoke test、长任务观察 | `run_task`、`run_command`、`http_request`、`get_command_status`、`get_command_output` |

这个表的重点不是名字，而是约束：工具越能改变用户机器状态，越应该只给明确需要它的 agent profile，并进入 permission path。

### Tool 改变 agent loop 的数据流

没有 tool 时，agent loop 是一次 provider call：

```text
user message
  -> context
  -> provider
  -> assistant answer
```

有 tool 后，agent loop 变成可迭代状态机：

```text
user message
  -> context
  -> provider
  -> model requests tool
  -> runtime executes tool
  -> optimized tool result returns to context
  -> provider continues
  -> assistant answer
```

因此 tool 不是附加功能。它会直接影响：

- provider request 的 tool definitions。
- context window 的组成。
- token usage。
- stop reason。
- event log。
- permission decision。
- UI 如何展示 agent 的工作过程。

如果 Lesson 1.3 只教“注册一个函数然后执行”，学习者会误以为 tool layer 很薄。实际产品里，tool layer 是 agent runtime 的核心边界之一。

## RTK 策略参考

RTK 的价值不在于它是一个命令前缀，而在于它把 shell output 当成需要优化和观测的数据流处理。

RTK 的典型路径可以抽象成：

```text
command
  -> parse
  -> route by command kind
  -> execute
  -> filter / summarize
  -> print optimized output
  -> track token savings
```

Floris 不需要依赖 RTK adapter。我们要借鉴的是策略 taxonomy 和可观测性，把它们内置到 runtime。

### 可借鉴的策略

| 策略 | 适合场景 | Floris 中的落点 |
| --- | --- | --- |
| stats extraction | `git diff`、test summary、build summary | `git_diff`、`run_task`、`run_command` filter |
| failure focus | test / lint / typecheck 失败 | `test-output-filter`、`lint-output-filter` |
| error only | build log 很长但只有几段 error | `generic-output-filter` |
| group by pattern | lint diagnostics、repeated stack traces | command output filters |
| deduplication | repeated progress lines、重复 warning | `progress-filter`、`generic-output-filter` |
| structure only | JSON / HTML / package metadata | `http_request`、`read_file` 的 outline mode |
| progress filtering | dev server、install、build progress | `run_command` ring buffer + progress filter |
| tail / head | 大日志初步判断 | `get_command_output` |
| raw ref only | 输出过大或二进制内容 | artifact store + `rawRef` |

### 为什么不接 RTK adapter

Floris 需要验证“压缩后的 tool result 是否仍然足够让 LLM 做对下一步”。如果外部 proxy 已经把输出处理完，runtime 很难稳定记录：

- 哪个 filter 生效。
- raw output 有多大。
- context output 有多大。
- 哪些 section 被省略。
- 省略内容的 rawRef 是什么。
- 这次压缩是否导致 agent 判断错误。

这些信息要进入 Context Inspector、session replay、测试 fixture 和后续 A/B 验证，所以必须在 runtime 内部完成。

结论：

- 不提供 `rtk` adapter。
- 不要求用户安装 `rtk`。
- 不让 agent 记住“命令前加 rtk”这种规则。
- 内置 RTK-style output optimization，并把策略、指标、rawRef 写入 tool result envelope。

### 教学重点

RTK 给 Lesson 1.3 的教学启发是：**command output 不是普通文本，而是需要预算、过滤、审计和回放的数据源**。

这也解释了为什么 `run_command` 不能只是 `spawn(command)` 后返回 stdout。对 code agent 来说，stdout 可能是：

- 测试失败的唯一证据。
- build 错误的定位线索。
- dev server 是否启动成功的信号。
- install 过程里无关 progress 的噪声。
- 可能包含 secret 的敏感输出。
- 几万 token 的 context 污染源。

因此 `run_command` 从第一版就必须带 output optimizer。

## 设计原则

### Tool 是 runtime contract，不是函数集合

Agent loop 只知道 `ToolRegistry`，不 import 具体 tool。

```text
provider tool_call_done
  -> AgentLoop
  -> PreToolUse hook
  -> PermissionGate
  -> ToolRegistry.execute()
  -> tool-specific optimization
  -> PostToolUse hook
  -> ContextBudgetGuard
  -> next provider request
```

这样做的原因：

- 不同 agent profile 可以拥有不同 tool scope。
- tool call、权限判断、输出过滤和 session log 可以统一记录。
- 后续 SwiftUI 可以用同一份 event 渲染 tool started、tool finished、raw output、optimized context。

### Tool output 必须 token-aware

Floris 的核心目标包含节省 token 和观察 token，所以 tool result 不能是单个 `string`。

推荐升级后的结果形状：

```ts
export interface ToolResultEnvelope {
  ok: boolean;
  summary: string;
  display: string;
  context: string;
  rawRef?: string;
  artifacts: ToolOutputArtifact[];
  metrics: ToolOutputMetrics;
  error?: ToolExecutionError;
}
```

字段职责：

- `summary`：短摘要，适合 chat UI 和 event list。
- `display`：给用户看的格式化内容，可以比 context 更完整。
- `context`：进入下一轮 model context 的内容，必须经过预算控制。
- `rawRef`：完整输出引用，保存到 artifact/session，默认不进入 context。
- `metrics`：记录 raw bytes、context bytes、token estimate、reduction ratio、truncated。

## Tools 如何进入 model request

Tool registry 里存在很多 tool，不代表每一轮都要把所有 tool definitions 发给 LLM。Tool definition 本身会消耗 token，而且 tool 越多，模型越容易选错、重复调用或把高风险能力当成普通能力。

通用 coding agent 一般会把问题拆成三层：

```text
ToolRegistry
  -> runtime 知道有哪些 tool

ActiveToolScope
  -> 本轮 model request 真正携带哪些 tool definitions

PermissionGate
  -> 某次具体 tool call 是否允许执行
```

这里要区分三种模式。它们不是命名差异，而是权限和 context 控制方式不同。

### Static Tool Scope

Static scope 是最稳的基础模式：

```text
runtime 根据 agent profile / mode / settings 选择 tools
  -> model request 携带这些 tool definitions
  -> LLM 在可见 tools 里选择 tool call
  -> 每次 tool call 再经过 permission / policy / hooks
```

这个模式里，LLM 不能主动改变自己的 tool scope。如果当前 tools 不够，它只能说明限制，或用已有 tools 尝试替代路径。

Claude Code、Amp 这类 coding agent 的公开设计更接近这个模式：用户配置、mode、settings、permission rules 决定 tool 可见范围和执行权限；LLM 在 runtime 给出的范围内调用。

Lesson 1 当前采用的就是 static scope。比如 `run-demo.ts --example analyze-case` 里，demo 手动设置：

```text
allowedTools:
  git_status
  list_files
  read_file
  search_files
  run_command
```

这不是模型根据 input 自动申请出来的，而是 demo scenario 预设的 tool scope。它用于验证模型是否会在给定工具范围内组合、分步调用 tools。

### Permission Request

Permission request 不是申请新增 tool，而是申请执行某次具体 tool call。

```text
run_command 已经在 active tool scope 里
  -> LLM 调用 run_command({ command: "bun", args: ["test"] })
  -> PermissionGate 判断这次调用是否自动允许、拒绝或需要用户确认
  -> 用户或 policy 允许后才执行
```

这里 tool definition 已经进入 model request。runtime 审查的是这一次调用的参数、cwd、风险标签和项目策略。

这类机制是 code agent 必须具备的基础能力，因为同一个 tool 的风险取决于参数：

- `git status` 低风险。
- `git push` 高风险。
- `rg` 读 workspace 通常低风险。
- 读取 workspace 外路径需要确认。
- `http_request` GET 本地 health endpoint 和 POST 到外部 API 风险不同。

### Dynamic Tool Scope Negotiation

Dynamic tool scope negotiation 是一个更进一步的设计：LLM 在发现当前 tools 不够时，先申请让某个 tool 进入后续 request。

```text
当前 active tools 没有 http_request
  -> LLM 调用 request_tool_access(["http_request"], reason, expectedUse)
  -> runtime 审查是否允许扩展 active tool scope
  -> 如果允许，下一轮 model request 才携带 http_request definition
  -> 之后具体 http_request 调用仍然经过 PermissionGate
```

这里申请的是“让 tool 变得可见”，不是直接执行 tool。它和 permission request 的区别是：

```text
Permission Request:
  tool 已经可见，审查一次具体调用能否执行

Tool Access Request:
  tool 还不可见，审查是否把 tool definition 加进后续 context
```

如果未来采用这个模式，不应该把完整的全部 tool definitions 都塞进 context。更合理的是提供一个短的 tool catalog summary：

```text
Additional tools may be requested when necessary:
- http_request: inspect HTTP endpoints or fetch public URLs
- apply_patch: edit workspace files
- run_command: run allowed local commands
- git_diff: inspect workspace diffs
```

LLM 如果需要，再通过控制面 tool 请求：

```json
{
  "toolNames": ["http_request"],
  "reason": "Need to inspect the local endpoint response.",
  "expectedUse": "GET http://127.0.0.1:3000/api/health"
}
```

runtime 再决定：

- tool 是否存在。
- 当前 agent role 是否允许申请。
- project / user policy 是否允许。
- 是否需要用户确认。
- 允许后 scope 作用于当前 run、thread、branch 还是 project。
- 何时过期。

### 当前结论：不急着采用 Dynamic Scope

这一节只是记录设计讨论，不代表 Floris 已经决定采用 dynamic tool scope negotiation。

当前 Lesson 1 的实现边界是：

```text
Static tool scope preset
  + 每次 tool call 的输入校验
  + tool 自身 domain filter
  + runtime ToolResultPolicy
```

下一阶段优先补的是 permission request，也就是对已经可见的 tool call 做正式 `PermissionGate` 审查、记录和用户确认。

Dynamic scope 可以保留为后续候选方案。它的好处是：

- 默认暴露更少 tool definitions，降低 token 成本。
- LLM 有结构化出口表达“当前工具不够”。
- UI 可以展示 agent 为什么申请新 tool。
- 高风险 tool 不必默认进入所有 request。

它的代价也很明确：

- 需要维护 active tool scope 状态。
- 需要设计 scope 的生命周期和 branch 继承规则。
- LLM 可能频繁申请工具，增加用户打扰。
- Context Inspector 要解释某个 tool 为什么进入了本轮 request。
- 测试要覆盖允许、拒绝、过期、重复申请和降级路径。

所以 Lesson 1 文档只把它作为可选设计方向记录下来。Floris 是否采用，需要等 static scope、permission gate、tool output filtering 稳定之后再决定。

## 两层过滤和 Hooks 的边界

两层过滤和 Floris hooks 相关，但不是同一个东西。过滤 pipeline 是 tool output 的内置处理能力；hooks 是 agent runtime 生命周期里的扩展点。

推荐结论：

```text
Tool 内部 optimizer = 必选、稳定、产品内核
Runtime ToolResultPolicy = 必选、稳定、最终守门
Agent Hooks = 可插拔扩展点，用于观察、阻止、记录或调整决策
```

也就是说，两层过滤不应该“全部用 hooks 实现”。Tool 自身必须先做领域过滤，runtime 再做统一守门。Hooks 只在关键生命周期点接收 typed payload。

完整 hooks 设计文档占位见 `docs/architecture/hooks.md`。当前 Lesson 1.4 的简要 hooks 说明仍在 `docs/architecture/agent-loop-implementation-paradigm.md`。

### 第一层：Tool 自身 Domain Filter

每种 tool 的最佳压缩方式不同，所以第一层必须在 tool 内部完成。

例子：

- `git_status`：返回 branch、ahead/behind、changed file counts、文件清单上限。
- `git_diff`：先返回 file stats、最大文件、hunk 上限，完整 diff 进 raw artifact。
- `http_request`：按 content-type 摘要 JSON / HTML / text / binary。
- `run_command`：按 command kind 提取 test failure、lint error、build summary、progress collapse。
- `search_files`：按 file 分组，限制 matches 和 snippet 数量。

Tool 自身过滤要产出：

```ts
{
  filterId: "git-diff-summary",
  strategy: "stats_extraction",
  context: "...",
  omittedSections: [...],
  metrics: {...}
}
```

为什么第一层不能放到 hook 里：

- `git_diff`、`http_request`、`run_command` 在内部最清楚 raw output 的结构。等输出变成普通 result 后再过滤，content-type、stderr/stdout、exit code、command kind 这些信息可能已经丢失。
- secret redaction、raw artifact 保存、token metrics 是默认安全能力，不能依赖外部 hook 是否注册。
- Tool 自身过滤可以单独测试：raw output -> optimized envelope。HookRunner 不应该成为每个 tool 单测的前置条件。

### 第二层：Runtime Guard

即使 tool 自身忘记压缩，runtime 也不能允许大输出直接进入 context。

第二层由这些位置负责：

- `ToolResultPolicy`：检查 optimized result，执行 redaction guard、budget guard、rawRef enforcement。
- `ContextBudgetGuard`：超过预算时，把内容降级成 summary + rawRef。
- `BeforeContextBuild`：在下一轮 provider request 前选择哪些 tool result 进入 context。

这个策略让 token 优化成为 runtime 默认能力，而不是用户手工要求 agent 少输出。

### Hooks 在过滤 pipeline 里的位置

Hooks 不负责每个 tool 的核心过滤逻辑。它们负责在生命周期点观察、阻止、记录或调整决策。

推荐执行路径：

```text
Model tool call
  -> AgentLoop receives ModelToolCall
  -> PreToolUse hook
  -> PermissionGate.check
  -> ToolRegistry.execute
      -> Tool validates input
      -> Tool performs action
      -> Tool stores raw artifact
      -> Tool-specific OutputOptimizer
      -> ToolResultEnvelope
  -> ToolResultPolicy
      -> redaction guard
      -> context budget guard
      -> final context payload
  -> PostToolUse hook
  -> append tool event
  -> append tool message for next provider request
```

`PreToolUse` 适合做：

- 检查 agent profile 是否允许这个 tool。
- 补充 risk tags。
- 让 permission layer 决定 allow / deny / needs approval。
- 记录 tool call plan。

`PreToolUse` 不适合做 output filtering，因为此时还没有 output。

`PostToolUse` 适合做：

- 记录 raw token estimate 和 optimized token estimate。
- 把 filter decision 写入 session event。
- 让 debug / telemetry 观察 tool 效果。
- 对 context policy 提建议。

`PostToolUse` 不适合绕过 Runtime Guard，也不应该代替 tool-specific optimizer。

`BeforeContextBuild` 适合做：

- 决定哪些 tool result 进入 context。
- 按 token budget 选择 summary / context / rawRef。
- 应用用户临时 exclude。
- 生成 Context Inspector 可展示的 context plan。

`BeforeContextBuild` 不适合解析 HTTP body、test log 或 git diff。这些领域解析应该在 tool 内部完成。

### 推荐实现顺序

Lesson 1.3 先做 tool pipeline，不被 Lesson 1.4 HookRunner 阻塞：

1. 升级 `ToolResult` 到 `ToolResultEnvelope`。
2. 实现内存版 `ToolOutputArtifactStore`。
3. 实现 tool-specific domain filter。
4. 实现 `ToolResultPolicy` 和 context budget guard。
5. 定义 `PreToolUsePayload`、`PostToolUsePayload`、`BeforeContextBuildPayload`。
6. Lesson 1.4 再实现 `HookRunner` 调用这些 payload。

原则：

> Tool optimizer 负责把真实世界输出变成可用信息。Runtime guard 负责决定什么能进入 model context。Hooks 负责在生命周期点观察、阻止、记录或调整决策。

## 实现清单

### 第一批通用 tool

| Tool | 目标 | 默认 agent | Token 策略 |
| --- | --- | --- | --- |
| `list_files` | 列目录和 workspace 结构 | general + coding | tree compression、depth、limit、ignore rules |
| `read_file` | 读取文本文件片段 | general + coding | offset/limit、bytes cap、line cap |
| `search_files` | 搜索内容 | general + coding | group by file、match cap、snippet cap、rawRef |
| `run_command` | 执行受控命令 | coding | command classifier、failure focus、ring buffer、rawRef |
| `get_command_status` | 查询长命令状态 | coding | 只返回状态摘要和最新输出窗口 |
| `get_command_output` | 分页读取长命令输出 | coding | page/tail/error-section 读取，不默认全量 |
| `stop_command` | 停止长命令 | coding | 返回状态变化摘要 |
| `apply_patch` | 通过 patch 修改文件 | coding | patch stats、changed files、raw patch artifact |
| `git_status` | 查看 git 工作区状态 | general + coding | porcelain parser、文件数量和清单上限 |
| `git_diff` | 查看改动 diff | general + coding | numstat + scoped diff，默认摘要 |
| `list_tasks` | 发现 package scripts / Makefile / justfile | general + coding | 只返回任务名、来源、推荐入口 |
| `run_task` | 运行 test/lint/build/dev 等任务 | coding | 基于 `run_command`，按 task kind 过滤 |
| `http_request` | smoke test 本地服务或 API | coding + automation | content-type aware summary、body cap、redaction |

### 暂不进入 Lesson 1.3 的 tool

| Tool | 原因 |
| --- | --- |
| `delete_file` | 需要真实 permission gate 和更明确的 UI approval |
| `schedule_task` | 依赖 persistence、automation runner、thread wakeup |
| `send_notification` | 依赖 macOS bridge |
| `open_url` | 依赖 SwiftUI / browser bridge，runtime 先保留 contract 方向 |
| `hidden_delegated_task` | 第一阶段 multi-agent 是用户可见的显式 `@agent`，不做隐藏后台调度 |

## Command tool 设计

`run_command` 不应该叫 `run_shell`。我们给 agent 的能力是运行受控 command，不是打开自由 shell。

推荐输入：

```ts
export interface RunCommandInput {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}
```

默认不走 `zsh -lc`。这样 permission gate 可以稳定判断 command prefix：

```text
["bun", "test"]
["bun", "run", "check"]
["git", "status"]
["rg"]
```

确实需要 shell 特性时，后续再单独设计 `run_shell`，默认不开放。

### CommandClassifier

`run_command` 执行前后都要知道命令类型。

```ts
export type CommandKind =
  | "git"
  | "test"
  | "lint"
  | "typecheck"
  | "build"
  | "package_manager"
  | "http"
  | "docker"
  | "generic";
```

不同 kind 使用不同 output filter：

```ts
export type OutputOptimizationStrategy =
  | "stats_extraction"
  | "failure_focus"
  | "error_only"
  | "group_by_pattern"
  | "deduplicate"
  | "json_shape"
  | "progress_filter"
  | "tail_head"
  | "raw_ref_only";
```

## HTTP tool 的输出策略

`http_request` 默认不能把 response body 全量进 context。

- JSON：返回 status、关键 headers、top-level keys、数组长度、错误字段、前几条样本。
- HTML：返回 title、meta、主要文本摘要，不进入完整 HTML。
- text：按行数和 bytes 截断，重复行 dedupe。
- binary：只返回 content-type、bytes、sha256、artifact ref。
- headers：默认隐藏 `authorization`、`cookie`、`set-cookie` 和 token-like fields。

完整 response body 保存为 raw artifact，context 只带摘要。

## Git tools 的输出策略

`git_status` context 示例：

```text
branch: main
ahead/behind: 0/0
changed: 5 files
  M packages/agent-runtime/src/tools/tool.ts
  A packages/agent-runtime/src/tools/run-command-tool.ts
untracked: 2 files
raw: tool-output://...
```

`git_diff` 默认先返回：

```text
7 files changed, +183 -41
largest:
  src/core/agent-loop.ts +80 -12
  src/types/tool.type.ts +44 -8
raw: tool-output://...
```

如果 agent 需要某个文件的具体 diff，再调用 scoped `git_diff` with `paths`。

## 自定义和三方库选择

### 判断标准

选择三方库的条件：

- 领域规则复杂，自己写容易错，例如 glob、ignore、diff parse、patch parse。
- 库输出结构稳定，方便我们再做 token filter。
- 库不接管权限、安全、日志、context selection。
- 库在 Bun / Node / macOS app bundle 里可稳定分发。
- 依赖体积和维护成本可接受。

选择自定义的条件：

- 这部分是 Floris 的产品核心，例如 token optimization、permission metadata、tool event、artifact 引用。
- 需要完全控制 stdout / stderr、timeout、cancel、redaction。
- 需要和 Context Inspector、Memory、Session replay 强绑定。
- 外部库很难解释为什么这段进入 context、那段被省略。

### 结论

Floris 的核心 tool runtime 必须自定义；底层格式处理可以用三方库。

```text
自定义：
  tool envelope
  command runner
  process store
  output optimizer
  token metrics
  permission metadata
  artifact store

三方库：
  glob
  ignore
  diff / patch parsing
  MIME detection
```

### 逐项选择

| 模块 | 选择 | 原因 |
| --- | --- | --- |
| `ToolResultEnvelope` | 自定义 | Floris 核心 contract |
| `CommandRunner` | 自定义 | 要控制 process lifecycle、timeout、cancel、stdout/stderr ring buffer |
| `CommandProcessStore` | 自定义 | 要绑定 thread、branch、toolCallId、rawRef |
| `OutputOptimizer` | 自定义 | token 策略、可解释性、A/B 验证都靠它 |
| `TokenMetrics` | 自定义 | 第一版用估算，后续接 provider tokenizer |
| `ArtifactStore` | 自定义 | 要和 session persistence、Context Inspector 统一 |
| `PermissionMetadata` | 自定义 | 安全边界不能交给库 |
| ignore rules | 三方库 | `.gitignore` 语义边界多，建议用 `ignore` |
| glob matching | 三方库 | 建议用 `tinyglobby`，小而快 |
| `search_files` | 混合 | 优先 `rg --json`，fallback 自定义扫描 |
| `read_file` | 自定义 | 读取和截断策略是核心 |
| `apply_patch` parser | 三方库或小型自定义 | patch 格式细节复杂，但写入策略自定义 |
| `git_status` parser | 自定义 | `git status --porcelain=v1 -b` 格式简单稳定 |
| `git_diff` parser | 三方库辅助 | 可用 `diff` 或轻 parser；context 策略自定义 |
| `http_request` | 自定义 + 小库 | `fetch` 足够；可选 MIME helper |
| JSON summary | 自定义 | 要做 shape extraction、array sample、redaction |
| HTML summary | 可选三方库 | 后续可用 `cheerio`，不是 Lesson 1.3 必需 |
| secret redaction | 自定义规则为主 | policy 不能交给库 |

### 推荐依赖

第一批可加入：

```json
{
  "ignore": "...",
  "tinyglobby": "...",
  "diff": "..."
}
```

暂不加入：

```text
execa      # command runner 自定义
axios      # fetch 足够
shelljs    # 安全边界太宽
simple-git # git CLI 输出更透明
zod        # 项目默认 ArkType
```

## 建议源码结构

```text
packages/agent-runtime/src/tools/
  tool.ts
  tool-registry.ts
  echo-tool.ts
  files/
    list-files-tool.ts
    read-file-tool.ts
    search-files-tool.ts
  edit/
    apply-patch-tool.ts
  command/
    run-command-tool.ts
    get-command-status-tool.ts
    get-command-output-tool.ts
    stop-command-tool.ts
    command-runner.ts
    command-process-store.ts
    command-classifier.ts
    output-optimizer.ts
    filters/
      git-status-filter.ts
      git-diff-filter.ts
      test-output-filter.ts
      lint-output-filter.ts
      json-output-filter.ts
      generic-output-filter.ts
      progress-filter.ts
  git/
    git-status-tool.ts
    git-diff-tool.ts
  http/
    http-request-tool.ts
  tasks/
    list-tasks-tool.ts
    run-task-tool.ts
```

类型仍然集中在 `src/types`：

```text
packages/agent-runtime/src/types/
  tool.type.ts
  tool-output.type.ts
  command-tool.type.ts
  file-tool.type.ts
  git-tool.type.ts
  http-tool.type.ts
```

实现文件不定义跨模块 `type` / `interface`，只 `import type`。

## 测试策略

每个 tool 至少覆盖：

- input schema validation。
- 成功结果 envelope。
- rawRef 和 artifact 是否生成。
- token metrics 是否存在。
- 大输出是否被截断或摘要。
- secret-like 字段是否被 redacted。
- error path 是否是结构化 error。

Command 相关测试要用 fixture output，不依赖真实网络或大型命令：

- test failure output -> failure focus。
- lint output -> grouped diagnostics。
- build output -> error section + summary。
- progress output -> progress filter。
- large stdout -> rawRef only + tail/head。

Git 相关测试可以用临时 git repo，但必须小而确定。

HTTP 测试用本地 mock server 或 mocked fetch，不访问真实公网。

## Lesson 1.3 的取舍

Lesson 1.3 可以先完成 contract 和少量核心 tool，不要求一次实现全部 automation 能力。

推荐顺序：

1. 升级 `ToolResult` 到 envelope。
2. 实现 `ArtifactStore` 的内存版。
3. 加 `OutputOptimizer` contract 和 generic fallback。
4. 实现 `list_files`、`read_file`、`search_files`。
5. 实现 `run_command` 和 command output filters。
6. 实现 `git_status`、`git_diff`。
7. 实现 `apply_patch`。
8. 补 `http_request`、`list_tasks`、`run_task`。

这样每一步都能保留教学价值：先讲 tool contract，再讲 token-aware output，再讲 coding agent 的实际能力。
