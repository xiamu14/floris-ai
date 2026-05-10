# Tooling 选择

## 当前结论

Fate AI 第一阶段 TypeScript runtime 使用：

- package manager：Bun
- lint / format：Ultracite + Biome
- test runner：Vitest
- TypeScript：strict mode
- editor integration：Zed Biome extension

选择 Biome 作为 Ultracite 后端。暂不使用 Oxlint + Oxfmt 作为默认工具链。

## 参考资料

- Ultracite: https://github.com/haydenbleasel/ultracite
- Ultracite docs: https://www.ultracite.ai/
- Biome Zed extension: https://biomejs.dev/reference/zed/
- Zed Biome extension page: https://zed.dev/extensions/biome
- Oxfmt docs: https://oxc.rs/docs/guide/usage/formatter
- Oxfmt editor setup: https://oxc.rs/docs/guide/usage/formatter/editors
- Zed Oxc extension search: https://zed.dev/extensions?query=oxc

## Ultracite

Ultracite 是面向 AI coding workflow 的 lint / format preset。它的价值是：

- 默认规则比较完整，适合减少代码风格讨论。
- 基于 Biome 时速度快，适合 on-save。
- 对 TypeScript 项目友好。
- 支持 Zed、Claude Code、Codex 等 AI coding 场景。
- 允许后续按项目逐步调整，而不是一开始手写大量 lint 规则。

当前配置：

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.14/schema.json",
  "extends": ["ultracite/core"]
}
```

## Biome vs Oxlint / Oxfmt

### Biome

优点：

- Zed 有成熟 Biome extension。
- Biome 官方文档明确说明 Zed 安装、配置、formatter 设置。
- Zed Biome extension 会优先使用项目本地安装的 Biome。
- Ultracite 的核心 preset 是 Biome preset，当前接入路径最短。
- 对 TypeScript、JSON、JSONC 等 Lesson 1 主要文件类型已经足够。

不足：

- Oxfmt 官方 benchmark 声称比 Biome 更快。
- Biome 的生态规则覆盖和 Oxc 系工具未来发展需要持续观察。

### Oxlint + Oxfmt

优点：

- Oxfmt 面向大型 codebase，官方 benchmark 声称比 Prettier 和 Biome 更快。
- Oxfmt 支持 JS、TS、JSON、YAML、HTML、CSS、Markdown、GraphQL 等多种文件。
- Zed extension gallery 中已有 Oxc extension，说明 Zed 侧不是完全缺席。

不足：

- 对 Fate AI 当前阶段来说，Zed + Biome 的配置路径更明确。
- Ultracite + Biome 的默认 preset 更直接，不需要额外设计 Oxlint / Oxfmt 配置。
- Lesson 1 更需要稳定、可解释、少配置的工具链，不需要先追求极限性能。

## Zed 支持判断

Biome 在 Zed 里的支持更适合作为第一阶段默认选择：

- Zed extension marketplace 有 Biome extension。
- Biome 官方文档提供 Zed 配置说明。
- Biome extension 可以使用项目本地 Biome。
- `.zed/settings.json` 可以把 Biome language server 设为 formatter。

Oxc / Oxfmt 也有 Zed 支持，但当前项目不优先采用，原因是第一阶段代码量小，Biome 的编辑器体验和 Ultracite preset 的直接性更重要。

## 当前仓库约定

- TypeScript tooling 只放在 `packages/agent-runtime`。
- 在 `packages/agent-runtime` 内使用 `bun install` 管理依赖。
- 不提交 `package-lock.json`。
- 提交 `packages/agent-runtime/bun.lock`。
- 相关命令从 runtime package 运行：

```bash
cd packages/agent-runtime
bun run typecheck
bun run test
bun run check
bun run fix
```

## 后续评估点

未来可以重新评估 Oxlint / Oxfmt 的条件：

- TypeScript runtime 代码量明显变大。
- Biome check 成为明显性能瓶颈。
- Oxc Zed extension 和 Ultracite 的 Oxlint/Oxfmt 后端更加稳定。
- 项目需要 Oxfmt 已内置但 Biome 不方便支持的格式化能力。
