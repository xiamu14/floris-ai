# kanalabs UI/UX 总纲

本文记录 kanalabs 当前阶段已经确认的 UI/UX 总方向。它不是完整设计规范，也不覆盖所有组件细节。后续如果某个主题变复杂，拆成独立文档维护，避免一个文件越来越难读。

## 核心方向

kanalabs 是 chat-first 的 AI Agent workspace，不是传统功能页集合，也不是 full in chat。

用户优先通过对话表达意图。系统在 chat 里解释、生成、确认和管理交互产物。部分用户感知强、需要精确控制的操作仍然保留可见按钮，但按钮和对话触发应该进入同一套结果模型。

第一阶段先聚焦默认 `Chat`。它是通用 Agent 的主要入口。用户可以直接描述需求；当对话中出现 coding 等明确意图时，kanalabs 可以通过 chat item 引入或切换到更合适的能力 bot。

## 和传统 AI Chat 的差异

kanalabs 的差异不在三栏布局本身，而在交互模型：

- Bot 是能力入口，不只是会话容器。
- Chat item 是主要交互载体，不只是 assistant response。
- 用户不需要先学习功能页，但功能也不会全部藏进文本命令。
- 特定能力 thread 可以提供更聚焦的引导，而不是永远等待用户发指令。
- 右侧 `ChatRecordLift` 解决长对话回顾成本，不是装饰索引或全局导航。

## Bot 和 Thread

左侧能力入口当前包括 `Chat`、`Subscription`、`Service`、`Vision`。

这些入口不是传统管理页。它们都是 chat input 页面，只是切换到不同的 thread / ability context。用户可以理解为 kanalabs 里有多个互相认识的 AI bot。它们不是互相隔离的工具模块，而是共享 kanalabs 的 memory、workspace、用户偏好和已生成产物。

Bot 身份需要明确可见，但不做复杂 agent 配置 UI。用户选择能力 bot，不配置 agent runtime。Agent profile、tool scope、权限矩阵、调度策略都属于 runtime 内部。

当前 UI 主要通过 chat item 头像、intro item、语气和左侧选中入口表达 bot 差异，不需要额外做复杂 bot switcher。

## 默认 Chat

默认 `Chat` 是 kanalabs 的第一入口。

空态不是普通空消息列表，而是 input-first command surface。视觉中心应该是输入框，欢迎内容和 starter prompts 为输入服务。进入真实对话后，页面自然变成 chat stream。

第一屏内容应体现 kanalabs 的核心原则：用户不用先学菜单，直接说目标。可以提供少量 starter prompts 和 workspace 入口，但不做独立 onboarding flow。

Onboarding 只通过 chat item 完成。第一次进入 `Chat`、`Subscription`、`Service`、`Vision` 时，各自可以用 intro chat item 和 starter prompts 做轻引导。

## 左侧区域

左侧是能力入口和少量历史，不是复杂管理页。

第一阶段保留固定入口和少量最近 `Chat` history。特定能力 bot 的复杂 history / thread 展开先不做。这样能保持 chat-first，不把用户重新拉回传统文件夹式导航。

后续如果其它 thread 出现 pending / running / failed 状态，可以在左侧对应入口使用轻量状态圆点提示。具体状态内容只在用户切换到对应 thread 后显示。

## 中间 Chat 区

中间区域是用户和 kanalabs 交互的主入口。

Rich chat item 是 kanalabs 的核心 UI 单元。它可以承载 markdown、audio、video、subscription、workspace、coding result、permission confirmation 等内容，但必须保留统一的 message 节奏。

已确认的原则：

- Rich chat item 必须遵循统一消息结构：bot 身份、主体内容、状态、操作入口、结果摘要。
- 新能力可以扩展内容形态，但不能脱离 chat message 的基本节奏。
- 有状态的 rich item 必须有生命周期状态。
- 生命周期状态需要通过 UI 明确表达，并配合服务状态反馈的微动画。
- 微动画只服务状态变化，例如创建中、确认后生效、失败重试、暂停恢复，不做装饰性动效。
- 原始 Chat 里的 rich item 不能隐藏或消失，后续仍然可以操作。

按钮和 prompt chip 的语义需要区分：

- 按钮用于明确动作。
- Prompt chip 用于补充意图或继续对话。
- 低风险、可逆、纯导航动作可以直接执行。
- 会创建或改变产物的动作需要进入确认态。
- 不确定意图时优先用 prompt chip，不要伪装成确定按钮。

Chat item 的产品 contract 由 kanalabs 自己定义。后续可以评估引入 assistant-ui 这类 headless behavior layer 帮助处理 stream rendering、composer、message actions、auto-scroll 等通用交互，但不能让第三方库接管 kanalabs 的 message / artifact / lifecycle 数据模型。

## 状态表达

Rich item 内部表达完整状态、主操作、失败原因和结果摘要。

当前 thread 中需要用户马上知道的 pending / running / failed 摘要，显示在 chat input 上方的留白区域。这个区域是 context-aware 的当前 thread 状态区，不是全局通知栏。

其它 thread 的状态不挤进当前输入区，只通过左侧入口轻提示。用户切换 thread 后，再看到该 thread 的具体状态。

第一阶段不做全局任务中心。

## Chat Input 和 Context

kanalabs 是 chat first，不是 full in chat。

用户可以通过自然语言触发 workspace、history search、mode 等操作；同时，用户感知强、需要精确控制的操作也可以保留可见按钮。对话触发和按钮触发应该进入同一套结果模型，并在 chat 中留下可理解的状态更新。

当前 chat input 下方已经承载轻量 context visibility，例如 workspace、model、context window reset。这个方向保留。

`context window reset / compact` 是面向熟悉 AI Agent 的用户和程序员的高级入口。普通用户不需要理解 context window 或 compact，也不应该在 onboarding 中被教育这个概念。对普通用户来说，历史保留、对话继续即可；context 管理在后台发生。

## 右侧 ChatRecordLift

右侧 `ChatRecordLift` 是用户输入快速滚动电梯，用来帮助用户在长对话中快速回到某个输入时刻。

它解决的是长对话回顾成本，不承担功能导航，不是全局 history，也不是 thread 结构索引。

已确认的原则：

- 右侧主要索引用户输入。
- 点击后快速滚动到对应 user message 附近。
- 可以考虑添加星标，标识重点输入。
- 小屏和移动端不显示。
- 它是 UX 补充，不是核心功能入口。

## Settings

Settings 第一阶段具体内容暂未确定。

当前倾向是在左侧底部用户昵称右侧提供入口，点击后打开弹窗。这个位置属于 account / app-level 操作，不属于中间 task flow。

## 待讨论

以下问题尚未定论，后续需要继续讨论：

- `overview.md` 更偏用户心智模型，还是同时包含部分组件结构约束。
- 右侧星标是个人书签，还是 context hint，或者两者兼具。
- Settings 具体包含哪些内容。
- 特定能力 bot 的 intro item 和 starter prompts。
- Context window 高级入口的具体文案和反馈。
- Rich chat item 的独立结构文档。
- Chat layout 的独立结构文档。
- Bot / thread 关系的独立文档。
- Chat stream rendering 自研和 assistant-ui headless primitives 的 spike 结论。
- 小屏自适应细节。
