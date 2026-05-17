# Chat Stream Rendering 选型

本文记录 kanalabs chat item 流式渲染的技术选型方向。当前结论是待验证，不是最终实现方案。

## 当前结论

第一阶段不直接全盘自研，也不把 kanalabs chat 交给第三方 chat framework。

推荐做一个 spike：验证 assistant-ui 是否适合作为 headless behavior layer。HeroUI 继续作为 design system，kanalabs 自己定义 chat item 产品 contract 和数据模型。

## 边界

kanalabs 自己负责：

- Message / thread / bot / artifact 数据模型。
- Rich chat item 的生命周期状态。
- Agent stream event contract。
- 和 Floris Agent runtime 的事件映射。
- 右侧 `ChatRecordLift` 的用户输入锚点。
- Bot / ability thread 的产品语义。

assistant-ui 如采用，只能负责通用 UI behavior：

- Thread viewport。
- Composer。
- Message actions。
- Stream rendering 基础交互。
- Auto-scroll。
- Keyboard / accessibility 基础能力。

## 集成方向

如果验证 assistant-ui，优先考虑 primitives 和外部状态模式。kanalabs 应保留 message source of truth，不让 assistant-ui 接管 session persistence 或 thread 数据来源。

HeroUI 组件继续承担视觉和 design system。assistant-ui 只作为行为层，不决定 kanalabs 的视觉结构。

## Spike 需要回答的问题

- assistant-ui 是否能稳定支持 React 19 和当前 Vite / TanStack Router 结构。
- 是否能和 HeroUI 组件通过 headless / `asChild` 模式组合。
- 是否能用外部 store 接入 Floris runtime stream events。
- Tool call / rich artifact / lifecycle state 是否能自然映射。
- Auto-scroll、message action、composer keyboard 行为是否明显减少自研成本。
- 是否会引入过重 abstraction，反而限制 kanalabs 的 rich chat item 设计。
