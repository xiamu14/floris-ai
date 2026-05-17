import { describe, expect, it } from "vitest";
import { BasicContextBuilder } from "../src/context/context-builder";
import { AgentLoop } from "../src/core/agent-loop";
import { InMemorySessionStore } from "../src/session/in-memory-session-store";
import { echoTool } from "../src/tools/echo-tool";
import { InMemoryToolOutputArtifactStore } from "../src/tools/tool-output-artifact-store";
import { InMemoryToolRegistry } from "../src/tools/tool-registry";
import type { AgentProfile } from "../src/types/agent.type";
import type {
  PermissionCheckRequest,
  PermissionDecision,
  PermissionGate,
} from "../src/types/permission.type";
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
  TraceSpanHandle,
  TraceSpanStartInput,
} from "../src/types/trace.type";

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
    expect(provider.requests[0]?.maxOutputTokens).toBe(4096);
    expect(provider.requests[1]?.maxOutputTokens).toBe(4096);
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

  it("checks permission before executing a tool call", async () => {
    const permissionGate = new RecordingPermissionGate();
    const provider = new ScriptedTestProvider([
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
        text: "done",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
    const loop = createLoopWithProvider(
      provider,
      600,
      undefined,
      permissionGate
    );

    const result = await loop.runTurn({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      workspacePath: "/workspace",
      userMessage: "echo hello",
    });

    expect(permissionGate.requests).toEqual([
      expect.objectContaining({
        toolCallId: "tool-call-1",
        toolName: "echo_tool",
        cwd: "/workspace",
      }),
    ]);
    expect(result.events.map((event) => event.type)).toContain(
      "permission_checked"
    );
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

  it("records model and tool spans when a trace recorder is configured", async () => {
    const traceRecorder = new FakeTraceRecorder();
    const provider = new ScriptedTestProvider([
      {
        type: "tool_call_done",
        toolCall: {
          id: "tool-call-1",
          name: "echo_tool",
          input: { text: "hello" },
        },
      },
      {
        type: "usage",
        usage: {
          inputTokens: 2,
          outputTokens: 3,
          totalTokens: 5,
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
        type: "usage",
        usage: {
          inputTokens: 4,
          outputTokens: 5,
          totalTokens: 9,
        },
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
    const loop = createLoopWithProvider(provider, 600, traceRecorder);

    const result = await loop.runTurn({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      userMessage: "echo hello",
    });

    expect(result.stopReason).toBe("assistant_done");
    expect(traceRecorder.runStart).toMatchObject({
      threadId: "thread",
      branchId: "branch",
      userMessage: "echo hello",
    });
    expect(traceRecorder.spans.map((span) => span.name)).toContain(
      "context.build"
    );
    expect(traceRecorder.spans.map((span) => span.name)).toContain(
      "model.request"
    );
    expect(traceRecorder.spans.map((span) => span.name)).toContain(
      "tool.echo_tool"
    );
    expect(
      traceRecorder.spans.find((span) => span.name === "model.request")?.inputs
    ).toMatchObject({
      messagesPreview: [
        {
          role: "user",
          contentPreview: "echo hello",
        },
      ],
      systemPreview: expect.any(Array),
      toolNames: ["echo_tool"],
      maxOutputTokens: 4096,
    });
    expect(traceRecorder.spanFinishes.at(-1)).toMatchObject({
      outputs: {
        textPreview: "done",
      },
    });
    expect(
      traceRecorder.providerEvents.map((event) => event.eventType)
    ).toEqual([
      "tool_call_done",
      "usage",
      "done",
      "text_delta",
      "usage",
      "done",
    ]);
    expect(
      traceRecorder.providerEvents.find((event) => event.usage)
    ).toMatchObject({
      usage: {
        inputTokens: 2,
        outputTokens: 3,
        totalTokens: 5,
      },
    });
    expect(traceRecorder.runFinish).toMatchObject({
      stopReason: "assistant_done",
      finalMessage: "done",
      usage: {
        inputTokens: 6,
        outputTokens: 8,
        totalTokens: 14,
      },
      metrics: {
        contextBuildCount: 2,
        modelRequestCount: 2,
        toolCallCount: 1,
      },
    });
    expect(traceRecorder.flushCount).toBe(1);
  });

  it("redacts sensitive text from model trace previews", async () => {
    const traceRecorder = new FakeTraceRecorder();
    const provider = new ScriptedTestProvider([
      {
        type: "text_delta",
        text: "token=secret-output",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
    const loop = createLoopWithProvider(provider, 600, traceRecorder);

    await loop.runTurn({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      userMessage: "api_key=secret-input",
    });

    expect(
      traceRecorder.spans.find((span) => span.name === "model.request")?.inputs
    ).toMatchObject({
      messagesPreview: [
        {
          contentPreview: "api_key=[redacted]",
        },
      ],
    });
    expect(
      traceRecorder.spanFinishes.find((finish) =>
        Boolean(
          typeof finish.outputs === "object" &&
            finish.outputs !== null &&
            "textPreview" in finish.outputs
        )
      )
    ).toMatchObject({
      outputs: {
        textPreview: "token=[redacted]",
        textTailPreview: "token=[redacted]",
      },
    });
  });

  it("stops as provider max tokens when the model cannot finish", async () => {
    const loop = createLoop([
      {
        type: "text_delta",
        text: "partial answer",
      },
      {
        type: "done",
        stopReason: "max_tokens",
      },
    ]);

    const result = await loop.runTurn({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      userMessage: "answer with too much detail",
    });

    expect(result.stopReason).toBe("provider_max_tokens");
    expect(result.finalMessage).toBe("partial answer");
  });

  it("uses a final no-tool synthesis request after max iterations", async () => {
    const provider = new ScriptedTestProvider([
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
        text: "forced final",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
    const loop = createLoopWithProvider(provider);

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

    expect(result.stopReason).toBe("assistant_done");
    expect(result.finalMessage).toBe("forced final");
    expect(result.events.map((event) => event.type)).toContain(
      "forced_synthesis_started"
    );
    expect(provider.requests).toHaveLength(2);
    expect(provider.requests[1]?.tools).toEqual([]);
    expect(provider.requests[1]?.maxOutputTokens).toBe(8192);
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
      options: {
        forceSynthesisOnMaxIterations: false,
      },
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
  toolContextMaxTokens = 600,
  traceRecorder?: TraceRecorder,
  permissionGate?: PermissionGate
): AgentLoop {
  return new AgentLoop({
    provider,
    toolRegistry: new InMemoryToolRegistry([echoTool]),
    toolOutputArtifactStore: new InMemoryToolOutputArtifactStore(),
    toolContextMaxTokens,
    contextBuilder: new BasicContextBuilder(),
    sessionStore: new InMemorySessionStore(),
    ...(traceRecorder ? { traceRecorder } : {}),
    ...(permissionGate ? { permissionGate } : {}),
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

class RecordingPermissionGate implements PermissionGate {
  readonly requests: PermissionCheckRequest[] = [];

  check(request: PermissionCheckRequest): Promise<PermissionDecision> {
    this.requests.push(request);

    return Promise.resolve({
      decision: "allow",
      source: "default_noop",
      reason: "test allow",
      toolName: request.toolName,
      createdAt: "2026-05-17T00:00:00.000Z",
    });
  }
}

class FakeTraceRecorder implements TraceRecorder {
  runStart?: TraceRunStartInput;
  runFinish?: TraceRunFinishInput;
  readonly spans: TraceSpanStartInput[] = [];
  readonly spanFinishes: TraceSpanFinishInput[] = [];
  readonly providerEvents: TraceProviderEventInput[] = [];
  flushCount = 0;

  startRun(input: TraceRunStartInput): TraceRunHandle {
    this.runStart = input;

    return {
      startSpan: (spanInput: TraceSpanStartInput): TraceSpanHandle => {
        this.spans.push(spanInput);

        return {
          id: spanInput.id,
          finish: (finishInput?: TraceSpanFinishInput) => {
            if (finishInput) {
              this.spanFinishes.push(finishInput);
            }
          },
        };
      },
      recordProviderEvent: (eventInput: TraceProviderEventInput) => {
        this.providerEvents.push(eventInput);
      },
      finish: (finishInput: TraceRunFinishInput) => {
        this.runFinish = finishInput;
      },
    };
  }

  flush(): Promise<void> {
    this.flushCount += 1;
    return Promise.resolve();
  }
}
