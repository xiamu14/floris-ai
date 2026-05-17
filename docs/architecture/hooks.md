# Floris Hooks Architecture

## 状态

占位文档。完整 hooks 设计还没有展开。

当前相关设计散落在：

- `docs/architecture/agent-loop-implementation-paradigm.md`
- `docs/teaching/lesson1/1.3-tool-architecture.md`
- `docs/plans/lesson1-mvp-agent-loop.md`

## 待补内容

后续完整文档需要说明：

- 每个 hook 的触发时机。
- 每个 hook 的 typed payload。
- 每个 hook 的返回值。
- 哪些 hook 可以阻止流程。
- 哪些 hook 可以修改 context decision。
- 哪些 hook 只能观察和记录。
- hooks 和 PermissionGate、ToolResultPolicy、ContextBuilder 的边界。
- hooks 如何写入 session event。
- hooks 如何为未来 extension / user script 保持兼容。

## 初始 hook 列表

Lesson 1 第一版内部 typed hooks：

- `SessionStart`
- `BeforeContextBuild`
- `AfterContextBuild`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `UserInterrupt`

完整语义以后在本文件补齐。
