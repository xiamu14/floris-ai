import { describe, expect, it } from "vitest";
import { BasicContextBuilder } from "../src/context/context-builder";
import { AgentLoop } from "../src/core/agent-loop";
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

describe("agent loop", () => {
  it("runs a tool call and then returns a final answer", async () => {
    const script: ModelEvent[] = [
      {
        type: "tool_call_done",
        reasoningContent: "I should call echo_tool.",
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
    ];
    const provider = new ScriptedTestProvider(script);
    const loop = createLoopWithProvider(provider);

    const result = await loop.runTurn({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      userMessage: "echo hello",
    });

    expect(result.stopReason).toBe("assistant_done");
    expect(result.finalMessage).toBe("tool returned hello");
    expect(result.events.map((event) => event.type)).toContain("tool_finished");
    expect(
      result.events.find((event) => event.type === "tool_finished")?.payload
    ).toMatchObject({
      outputFiltering: {
        domainFilter: "echo-domain-filter",
        strategy: "structure_only",
        rawTokens: 2,
        contextTokens: 2,
        truncated: false,
      },
    });
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]).toMatchObject({
      messages: [
        {
          role: "user",
          content: "echo hello",
        },
        {
          role: "assistant",
          reasoningContent: "I should call echo_tool.",
          toolCalls: [
            {
              id: "tool-call-1",
              name: "echo_tool",
              input: { text: "hello" },
            },
          ],
        },
        {
          role: "tool",
          content: "hello",
          toolCallId: "tool-call-1",
        },
      ],
    });
  });

  it("downgrades oversized tool context through the runtime guard", async () => {
    const loop = createLoop(
      [
        {
          type: "tool_call_done",
          toolCall: {
            id: "tool-call-1",
            name: "echo_tool",
            input: { text: "hello world" },
          },
        },
        {
          type: "done",
          stopReason: "tool_use",
        },
        {
          type: "text_delta",
          text: "tool returned summary",
        },
        {
          type: "done",
          stopReason: "end_turn",
        },
      ],
      1
    );

    const result = await loop.runTurn({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      userMessage: "echo hello world",
    });

    expect(result.stopReason).toBe("assistant_done");
    expect(
      result.events.find((event) => event.type === "tool_finished")?.payload
    ).toMatchObject({
      result: {
        context: {
          content: "Echoed 11 character(s).",
          policy: "summary_only",
        },
        metrics: {
          truncated: true,
        },
        omitted: [
          {
            reason: "context_budget_exceeded",
          },
        ],
      },
      outputFiltering: {
        domainFilter: "echo-domain-filter",
        strategy: "structure_only",
        truncated: true,
      },
    });
  });

  it("records multiple provider tool calls in the same iteration", async () => {
    const provider = new ScriptedTestProvider([
      {
        type: "tool_call_done",
        toolCall: {
          id: "tool-call-1",
          name: "echo_tool",
          input: { text: "first" },
        },
      },
      {
        type: "tool_call_done",
        toolCall: {
          id: "tool-call-2",
          name: "echo_tool",
          input: { text: "second" },
        },
      },
      {
        type: "done",
        stopReason: "tool_use",
      },
      {
        type: "text_delta",
        text: "done",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
    const loop = createLoopWithProvider(provider);

    const result = await loop.runTurn({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      userMessage: "echo first and second",
    });
    const providerToolCalls = result.events.filter(
      (event) => event.type === "provider_tool_call_done"
    );

    expect(result.stopReason).toBe("assistant_done");
    expect(providerToolCalls).toHaveLength(2);
    expect(providerToolCalls.map((event) => event.payload)).toMatchObject([
      {
        iteration: 0,
        event: {
          toolCall: {
            id: "tool-call-1",
            name: "echo_tool",
          },
        },
      },
      {
        iteration: 0,
        event: {
          toolCall: {
            id: "tool-call-2",
            name: "echo_tool",
          },
        },
      },
    ]);
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

function createLoop(
  script: ModelEvent[],
  toolContextMaxTokens = 600
): AgentLoop {
  return createLoopWithProvider(
    new ScriptedTestProvider(script),
    toolContextMaxTokens
  );
}

function createLoopWithProvider(
  provider: ModelProvider,
  toolContextMaxTokens = 600
): AgentLoop {
  return new AgentLoop({
    provider,
    toolRegistry: new InMemoryToolRegistry([echoTool]),
    toolOutputArtifactStore: new InMemoryToolOutputArtifactStore(),
    toolContextMaxTokens,
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
  readonly requests: ModelRequest[] = [];
  private cursor = 0;
  private readonly script: ModelEvent[];

  constructor(script: ModelEvent[]) {
    this.script = script;
  }

  async *createMessage(
    request: ModelRequest,
    signal?: AbortSignal
  ): AsyncIterable<ModelEvent> {
    await Promise.resolve();
    this.requests.push(request);

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
