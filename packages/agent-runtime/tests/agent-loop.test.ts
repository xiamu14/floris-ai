import { describe, expect, it } from "vitest";
import { BasicContextBuilder } from "../src/context/context-builder";
import { AgentLoop } from "../src/core/agent-loop";
import { InMemorySessionStore } from "../src/session/in-memory-session-store";
import { echoTool } from "../src/tools/echo-tool";
import { InMemoryToolRegistry } from "../src/tools/tool-registry";
import type { AgentProfile } from "../src/types/agent.type";
import type {
  ModelEvent,
  ModelProvider,
  ModelRequest,
} from "../src/types/provider.type";

describe("agent loop", () => {
  it("runs a tool call and then returns a final answer", async () => {
    const loop = createLoop([
      {
        type: "tool_call_done",
        toolCall: {
          id: "tool-call-1",
          name: "echo_tool",
          input: { text: "hello" },
        },
      },
      {
        type: "done",
        stopReason: "tool_use",
      },
      {
        type: "text_delta",
        text: "tool returned hello",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);

    const result = await loop.runTurn({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      userMessage: "echo hello",
    });

    expect(result.stopReason).toBe("assistant_done");
    expect(result.finalMessage).toBe("tool returned hello");
    expect(result.events.map((event) => event.type)).toContain("tool_finished");
  });

  it("stops when max iterations is reached", async () => {
    const loop = createLoop([
      {
        type: "tool_call_done",
        toolCall: {
          id: "tool-call-1",
          name: "echo_tool",
          input: { text: "hello" },
        },
      },
      {
        type: "done",
        stopReason: "tool_use",
      },
      {
        type: "tool_call_done",
        toolCall: {
          id: "tool-call-2",
          name: "echo_tool",
          input: { text: "again" },
        },
      },
      {
        type: "done",
        stopReason: "tool_use",
      },
    ]);

    const result = await loop.runTurn({
      profile: {
        ...createProfile(),
        stopPolicy: {
          maxIterations: 1,
          stopOnProviderError: true,
          stopOnToolError: true,
        },
      },
      threadId: "thread",
      branchId: "branch",
      userMessage: "echo hello",
    });

    expect(result.stopReason).toBe("max_iterations");
  });
});

function createLoop(script: ModelEvent[]): AgentLoop {
  return new AgentLoop({
    provider: new ScriptedTestProvider(script),
    toolRegistry: new InMemoryToolRegistry([echoTool]),
    contextBuilder: new BasicContextBuilder(),
    sessionStore: new InMemorySessionStore(),
  });
}

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

class ScriptedTestProvider implements ModelProvider {
  readonly id = "test";
  private cursor = 0;
  private readonly script: ModelEvent[];

  constructor(script: ModelEvent[]) {
    this.script = script;
  }

  async *createMessage(
    _request: ModelRequest,
    signal?: AbortSignal
  ): AsyncIterable<ModelEvent> {
    await Promise.resolve();

    while (this.cursor < this.script.length) {
      if (signal?.aborted) {
        return;
      }

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
