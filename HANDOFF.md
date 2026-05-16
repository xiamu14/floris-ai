# HANDOFF

## Goal

Continue Floris AI Lesson planning and agent-runtime work from a clean context.

The current product direction is:

- Lesson 1 remains the MVP Agent Loop: shallow implementation of the main runtime path, file structure, coding conventions, provider boundary, tool registry, hooks position, context/session/memory/permission stubs, agent loop, and demo.
- Lesson 2 and later are organized by capability completeness, not by tiny engineering modules.
- Floris should prioritize visible multi-agent collaboration over hidden subagents. Multi-agent should rely on shared work graph, session sync, branch tree, and future multi-window UI.
- UI approval and sandbox UX are required in the product shell, but their runtime protocol must be designed earlier in Coding Agent Core.

## Current Progress

Latest pushed commit:

```text
345ee3c Link lesson planning docs
```

Branch and remote:

```text
main -> origin/main
```

Working tree was clean before creating this handoff file.

Major changes already committed:

- Added the tool two-layer filtering architecture:
  - `ToolResultEnvelope` style result shape.
  - raw artifact store and `rawRef`.
  - tool domain filters.
  - runtime `ToolResultPolicy`.
  - output filtering metrics in `tool_finished` events.
- Added real first-pass runtime tools:
  - `list_files`
  - `read_file`
  - `search_files`
  - `git_status`
  - `http_request`
  - `run_command`
- Added `frameworkContext`:
  - typed keys.
  - immutable context.
  - scenario contexts for tool execution and provider request.
  - agent loop now uses it for run context, artifact store, and tool result policy.
- Fixed MIMO / OpenAI-compatible tool-call continuation issue:
  - preserved provider `reasoning_content`.
  - passed it back on assistant tool-call messages.
  - added provider compatibility option for tool result message role.
- Improved `run-demo.ts`:
  - supports `--example analyze-case`.
  - points that example at `src/demo/case`.
  - prints `frameworkContext`, `toolCallSequence`, and `toolOutputFiltering`.
  - `analyze-case` validates whether the LLM combines tools and calls them step by step.
- Added docs:
  - `docs/teaching/lesson1/tool-architecture.md`
  - `docs/architecture/framework-context.md`
  - `docs/architecture/hooks.md`
  - `docs/plans/lesson-roadmap.md`
- Updated `AGENTS.md`:
  - no longer duplicates lesson roadmap content.
  - links to lesson documents instead.
- Reworked lesson roadmap:
  - Lesson 1: MVP Agent Loop.
  - Lesson 2: Coding Agent Core.
  - Lesson 3: Persistent Work Graph.
  - Lesson 4: Context and Memory System.
  - Lesson 5: Extension and Integration Layer.
  - Lesson 6: Multi-Agent Collaboration.
  - Lesson 7: Product Shell and UI.
- Lesson 2-6 roadmap now uses capability-oriented sections:
  - ability result.
  - engineering implementation.
  - acceptance signal.

## What Worked

- Keeping `AGENTS.md` as a high-level collaboration entrypoint worked better than duplicating roadmap details there.
- Moving the detailed roadmap to `docs/plans/lesson-roadmap.md` reduced document drift.
- The `frameworkContext` abstraction solved growing parameter pass-through pressure in agent loop, provider request mapping, and tool execution.
- Tool output filtering is now observable in events:
  - raw tokens.
  - context tokens.
  - reduction ratio.
  - filter strategy.
  - `rawRef`.
- `run-demo.ts --example analyze-case` now creates the right provider request shape for a case-repo analysis demo:
  - workspace path set to `src/demo/case`.
  - allowed tools limited to relevant read / command tools.
  - max iterations raised for multi-step tool use.
- Unit tests covered the important runtime behavior:
  - framework context.
  - multiple tool calls in one provider response.
  - tool result filtering.
  - workspace tools.
  - OpenAI-compatible mapping and MIMO compatibility.

Latest discussion before continuing Lesson 1.3 remaining tools:

- The user wants to pause before adding more tools and discuss how to observe the Agent Loop runtime better.
- Current demo logs print the process in the command output. This is already too hard to read for multi-iteration loops and multiple tool calls.
- The same observation system should also become the foundation for early benchmark tests, so benchmark data is not bolted on later.
- External references checked:
  - Claude Code hooks docs: lifecycle events, debug file via `claude --debug-file <path>`, verbose hook matching with `CLAUDE_CODE_DEBUG_LOG_LEVEL=verbose`, and hook stdout/stderr written to a debug log.
  - Claude Code monitoring docs: OpenTelemetry support for metrics, logs/events, and optional traces.
  - Pi session format docs: sessions are JSONL files with typed entries, tree structure through `id` / `parentId`, compaction entries, branch summaries, model changes, and message entries with usage.
  - OpenCode troubleshooting docs: local log files under `~/.local/share/opencode/log/`, local project/session storage under `~/.local/share/opencode/project/`, and configurable log level.
  - MLflow OpenCode tracing docs: plugins can capture user prompts, assistant responses, tool usage, turn timing, token usage, session ID, and user metadata.

Key conclusion:

- Floris should not keep relying on console output as the primary debug surface.
- The runtime should persist structured agent-loop trace data first, then render it into CLI summaries, debug files, UI timelines, and benchmark reports.
- Console output should become a thin viewer, not the source of truth.

Recommended observability direction for the next implementation round:

1. Add an `observability` or `trace` module in `packages/agent-runtime/src/`.
2. Define trace types in `packages/agent-runtime/src/types/trace.type.ts`.
3. Keep `AgentEvent` as the product/session event, but add a separate `RunTrace` / `TraceSpan` model for debugging and benchmark analysis.
4. Store traces as JSONL files in a local artifact directory during demo runs, for example `packages/agent-runtime/.floris-traces/`.
5. Use stable IDs:
   - `runId`
   - `threadId`
   - `branchId`
   - `iteration`
   - `modelRequestId`
   - `toolCallId`
   - `parentSpanId`
6. Record timing and metrics on every important boundary:
   - context build duration and token estimate.
   - model request start / finish / error.
   - provider event counts.
   - tool start / finish / error.
   - raw output tokens, context tokens, reduction ratio, `rawRef`.
   - stop reason and total usage.
7. Add a small CLI viewer before UI:
   - `bun run trace:list`
   - `bun run trace:show <runId>`
   - `bun run trace:summary <runId>`
8. Keep debug logs controlled by explicit `DEBUG` or `trace` options. Runtime internals should not print by default.

Recommended benchmark direction:

1. Start with deterministic runtime benchmarks, not model-quality benchmarks.
2. Put benchmark fixtures under `packages/agent-runtime/benchmarks/` or `packages/agent-runtime/evals/`.
3. First eval suite should replay scripted provider events against the real AgentLoop:
   - single tool call.
   - multiple tool calls in one provider response.
   - multi-iteration tool chain.
   - recoverable tool error.
   - non-recoverable tool error.
   - max iteration stop.
   - output filtering budget.
4. Each case should assert:
   - final stop reason.
   - event sequence.
   - tool call sequence.
   - token usage / output filtering metrics.
   - whether the trace is valid and parseable.
5. Add real-provider smoke evals later, behind env vars, because network and model nondeterminism make them unsuitable as the first benchmark layer.
6. Use trace JSONL as the benchmark output artifact so a failed benchmark can be inspected with the same viewer used for manual debug.

Suggested data model split:

- `AgentEvent`: product-facing event stream for session replay and future UI.
- `TraceEvent`: low-level debug/event line, append-only JSONL, optimized for reading and tooling.
- `TraceSpan`: duration-based timing record with parent-child relation.
- `BenchmarkCase`: fixture input, scripted provider behavior, expected event/trace assertions.
- `BenchmarkRun`: output summary with pass/fail, duration, event count, token metrics, and trace file path.

Recommended next design decision:

- Discuss whether `RunTrace` should live inside `sessionStore` from day one or be a separate `TraceStore`.
- Recommendation: keep it separate for Lesson 1.3. Session is product history; trace is developer observability and benchmark artifact. Later the UI can link a session event to its trace.

Verification before push:

```bash
cd packages/agent-runtime
bun run typecheck
bun run test
bun run check
```

All passed before commit and push.

## What Didn't Work

- Running real MIMO requests from inside the sandbox repeatedly failed with:

```text
openai_provider_error: Connection error.
```

Escalated external run requests timed out during automatic permission review. The code path is ready, but real `run-demo.ts --example analyze-case` needs to be run in an environment with MIMO network access.

- The first roadmap draft split lessons too narrowly by engineering module. The user wanted large chapters organized by capability completeness.
- The first Lesson 1 summary drifted from existing docs. Lesson 1 must stay aligned with the existing 7-section structure in:
  - `docs/plans/lesson1-mvp-agent-loop.md`
  - `docs/teaching/lesson1/README.md`
- `src/demo/case` initially polluted TypeScript and Biome checks. It is now excluded from `tsconfig.json`, `biome.jsonc`, and `.gitignore`.
- `.codex/` and `graphify-out/` are local tool outputs and should not be committed. They were added to `.gitignore`.

## Next Steps

Recommended next conversation entrypoint:

1. Open `HANDOFF.md`.
2. Open `docs/plans/lesson1-mvp-agent-loop.md`.
3. Open `docs/teaching/lesson1/tool-architecture.md`.
4. Discuss the trace / benchmark design before adding more Lesson 1.3 tools.
5. After agreement, implement trace JSONL + small CLI viewer + deterministic benchmark fixtures.

Concrete next work candidates:

- Design the Lesson 1.3 observability slice:
  - `trace.type.ts`
  - `TraceStore`
  - JSONL trace writer.
  - summary renderer for CLI.
  - trace validation test.
- Design the first benchmark slice:
  - scripted provider fixture.
  - benchmark case contract.
  - benchmark runner.
  - assertions over stop reason, event sequence, tool call sequence, token metrics, and trace parseability.
- Only after the observability/benchmark foundation is agreed, continue the remaining tools.
- Run `rtk bun run demo --example analyze-case` outside the sandbox with MIMO network access and inspect:
  - tool call sequence.
  - whether the model calls tools step by step.
  - whether it hits `max_iterations`.
  - tool output filtering metrics.
- If `max_iterations` is still too low, decide whether to:
  - raise demo-only max iterations.
  - improve prompt guidance.
  - allow final synthesis after tool budget is reached.
- Formalize Lesson 2 plan:
  - workspace understanding.
  - workspace editing.
  - local verification.
  - repository awareness.
  - HTTP smoke testing.
  - token-aware tool output.
  - tool scope control.
  - safe execution runtime protocol.
  - provider and model policy hardening.
- Keep Permission Request as runtime protocol in Lesson 2, not full UI approval.
- Keep UI approval and sandbox UX for Lesson 7, but do not postpone runtime protocol design until UI.
- Avoid reintroducing hidden subagent terminology. Use visible multi-agent collaboration based on agent role, shared work graph, session sync, branch tree, and future multi-window UI.

## Important Files

- `AGENTS.md`
- `docs/plans/lesson-roadmap.md`
- `docs/plans/lesson1-mvp-agent-loop.md`
- `docs/teaching/lesson1/README.md`
- `docs/teaching/lesson1/tool-architecture.md`
- `docs/architecture/framework-context.md`
- `packages/agent-runtime/src/core/agent-loop.ts`
- `packages/agent-runtime/src/demo/run-demo.ts`
- `packages/agent-runtime/src/context/framework-context.ts`
- `packages/agent-runtime/src/tools/tool-result-policy.ts`
- `packages/agent-runtime/src/tools/workspace-tool-utils.ts`
