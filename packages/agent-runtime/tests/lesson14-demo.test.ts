import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BasicContextBuilder } from "../src/context/context-builder";
import { AgentLoop } from "../src/core/agent-loop";
import { InMemoryMemoryStore } from "../src/memory/memory-store";
import { NoopPermissionGate } from "../src/permissions/permission-gate";
import { InMemorySessionStore } from "../src/session/in-memory-session-store";
import { echoTool } from "../src/tools/echo-tool";
import { InMemoryToolOutputArtifactStore } from "../src/tools/tool-output-artifact-store";
import { InMemoryToolRegistry } from "../src/tools/tool-registry";
import type { AgentProfile } from "../src/types/agent.type";
import type {
  ModelEvent,
  ModelProvider,
  ModelRequest,
} from "../src/types/provider.type";
import type {
  TraceProviderEventInput,
  TraceRecorder,
  TraceRunFinishInput,
  TraceRunHandle,
  TraceRunStartInput,
  TraceSpanFinishInput,
  TraceSpanStartInput,
} from "../src/types/trace.type";

describe("lesson 1.4 demo flow", () => {
  it("builds context, memory, session, permission, tool, and trace boundaries together", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "floris-14-"));
    await writeFile(
      path.join(workspacePath, "AGENTS.md"),
      "Demo workspace rule: keep answers concise.\n",
      "utf8"
    );
    const memoryStore = new InMemoryMemoryStore();
    await memoryStore.add({
      scope: "thread",
      type: "summary",
      content: "Remember the demo thread context.",
      source: "user",
      threadId: "thread-14",
    });
    const sessionStore = new InMemorySessionStore();
    const traceRecorder = new DemoTraceRecorder();
    const provider = new DemoProvider([
      {
        type: "tool_call_done",
        toolCall: {
          id: "tool-call-14",
          name: "echo_tool",
          input: {
            text: "hello from demo",
          },
        },
      },
      {
        type: "done",
        stopReason: "tool_use",
      },
      {
        type: "text_delta",
        text: "demo complete",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
    const loop = new AgentLoop({
      provider,
      toolRegistry: new InMemoryToolRegistry([echoTool]),
      toolOutputArtifactStore: new InMemoryToolOutputArtifactStore(),
      contextBuilder: new BasicContextBuilder(),
      memoryStore,
      sessionStore,
      permissionGate: new NoopPermissionGate(),
      traceRecorder,
    });

    const result = await loop.runTurn({
      profile: createProfile(),
      threadId: "thread-14",
      branchId: "main",
      workspacePath,
      userMessage: "Run the lesson 1.4 demo.",
    });
    const sessionEvents = await sessionStore.listEvents({
      threadId: "thread-14",
      branchId: "main",
    });
    const secondSystem = provider.requests.at(1)?.system.join("\n\n") ?? "";
    const secondContextFinish = [...traceRecorder.spanFinishes]
      .reverse()
      .find((finish) => finish.id.startsWith("context."));

    expect(result.stopReason).toBe("assistant_done");
    expect(sessionEvents.map((event) => event.type)).toEqual(
      result.events.map((event) => event.type)
    );
    expect(result.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "context_built",
        "permission_checked",
        "tool_finished",
        "stop",
      ])
    );
    expect(secondSystem).toContain("Demo workspace rule");
    expect(secondSystem).toContain("Remember the demo thread context.");
    expect(secondSystem).toContain("Tool echo_tool (tool-call-14)");
    expect(secondSystem).toContain("hello from demo");
    expect(secondContextFinish?.input?.outputs).toMatchObject({
      sectionKinds: expect.arrayContaining([
        "system",
        "project_instructions",
        "recent_messages",
        "memory",
        "tool_results",
      ]),
    });
    expect(traceRecorder.runFinish).toMatchObject({
      stopReason: "assistant_done",
      metrics: {
        contextBuildCount: 2,
        modelRequestCount: 2,
        toolCallCount: 1,
      },
    });
    expect(traceRecorder.flushCount).toBe(1);
  });
});

function createProfile(): AgentProfile {
  return {
    id: "coder",
    displayName: "Coder",
    role: "coder",
    systemPrompt: {
      promptId: "agent.coder.system",
    },
    model: {
      providerId: "test",
      modelId: "test-coder",
    },
    allowedTools: ["echo_tool"],
    contextPolicy: {
      maxInputTokens: 4000,
      includeProjectInstructions: true,
      includeRecentMessages: true,
      includeMemory: true,
      includeToolDefinitions: true,
    },
    stopPolicy: {
      maxIterations: 4,
      stopOnProviderError: true,
      stopOnToolError: true,
    },
    writeAccess: "workspace",
  };
}

class DemoProvider implements ModelProvider {
  readonly id = "test";
  readonly requests: ModelRequest[] = [];
  private cursor = 0;
  private readonly script: ModelEvent[];

  constructor(script: ModelEvent[]) {
    this.script = script;
  }

  async *createMessage(request: ModelRequest): AsyncIterable<ModelEvent> {
    await Promise.resolve();
    this.requests.push(request);

    while (this.cursor < this.script.length) {
      const event = this.script[this.cursor];
      this.cursor += 1;

      if (!event) {
        return;
      }

      yield event;

      if (event.type === "done" || event.type === "error") {
        return;
      }
    }
  }
}

class DemoTraceRecorder implements TraceRecorder {
  runStart?: TraceRunStartInput;
  runFinish?: TraceRunFinishInput;
  readonly spans: TraceSpanStartInput[] = [];
  readonly spanFinishes: {
    id: string;
    input: TraceSpanFinishInput | undefined;
  }[] = [];
  readonly providerEvents: TraceProviderEventInput[] = [];
  flushCount = 0;

  startRun(input: TraceRunStartInput): TraceRunHandle {
    this.runStart = input;

    return {
      startSpan: (spanInput) => {
        this.spans.push(spanInput);

        return {
          id: spanInput.id,
          finish: (finishInput) => {
            this.spanFinishes.push({
              id: spanInput.id,
              input: finishInput,
            });
          },
        };
      },
      recordProviderEvent: (eventInput) => {
        this.providerEvents.push(eventInput);
      },
      finish: (finishInput) => {
        this.runFinish = finishInput;
      },
    };
  }

  flush(): Promise<void> {
    this.flushCount += 1;
    return Promise.resolve();
  }
}
