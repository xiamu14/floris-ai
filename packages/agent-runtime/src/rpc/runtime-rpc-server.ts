import { BasicContextBuilder } from "../context/context-builder";
import { AgentLoop } from "../core/agent-loop";
import { InMemorySessionStore } from "../session/in-memory-session-store";
import { buildRunGraph } from "../session/run-graph-builder";
import { toolRegistry } from "../tools/tool";
import { InMemoryToolOutputArtifactStore } from "../tools/tool-output-artifact-store";
import type { AgentProfile } from "../types/agent.type";
import type {
  ModelEvent,
  ModelProvider,
  ModelRequest,
} from "../types/provider.type";
import type {
  RunStartCommandPayload,
  RuntimeRpcCommandEnvelope,
} from "../types/rpc.type";
import type { AgentEvent, RunTurnResult } from "../types/runtime.type";
import type {
  AgentStreamEvent,
  AgentStreamEventType,
} from "../types/stream.type";
import { readJsonLines } from "./jsonl-reader";
import { createJsonLineWriter } from "./jsonl-writer";
import {
  createCommandAccepted,
  createCommandFailed,
  createStreamEventEnvelope,
  isRuntimeRpcCommand,
} from "./rpc-protocol";

export async function runRuntimeRpcServer(
  input = process.stdin,
  output = process.stdout
) {
  const writer = createJsonLineWriter(output);

  for await (const value of readJsonLines(input)) {
    if (!isRuntimeRpcCommand(value)) {
      await writer.write(
        createCommandFailed({
          code: "invalid_command",
          message: "Runtime RPC command is invalid.",
        })
      );
      continue;
    }

    if (value.type === "run.abort") {
      await writer.write(
        createCommandFailed({
          commandId: value.id,
          code: "abort_not_supported",
          message: "run.abort is not wired in the first JSONL RPC scaffold.",
        })
      );
      continue;
    }

    await handleRunStart(value, writer.write);
  }
}

async function handleRunStart(
  command: RuntimeRpcCommandEnvelope,
  write: (value: unknown) => Promise<void>
) {
  const payload = toRunStartPayload(command.payload);

  if (!payload) {
    await write(
      createCommandFailed({
        commandId: command.id,
        code: "invalid_run_start",
        message: "run.start requires a message payload.",
      })
    );
    return;
  }

  const runId = payload.runId ?? crypto.randomUUID();
  const threadId = payload.threadId ?? "local-thread";
  const branchId = payload.branchId ?? "main";
  const events: AgentEvent[] = [];
  const sessionStore = new StreamingSessionStore(events, async (event) => {
    const streamEvent = toStreamEvent({
      event,
      runId,
      threadId,
      branchId,
      finalMessage: "",
    });

    if (streamEvent) {
      await write(createStreamEventEnvelope(streamEvent));
    }
  });

  await write(createCommandAccepted({ commandId: command.id, runId }));
  await write(
    createStreamEventEnvelope(
      createStreamEvent({
        type: "run.started",
        runId,
        threadId,
        branchId,
        payload: {
          message: payload.message,
        },
      })
    )
  );

  try {
    const loop = new AgentLoop({
      provider: new ScriptedRuntimeProvider(),
      toolRegistry,
      toolOutputArtifactStore: new InMemoryToolOutputArtifactStore(),
      contextBuilder: new BasicContextBuilder(),
      sessionStore,
    });
    const result = await loop.runTurn({
      profile: createRuntimeProfile(),
      threadId,
      branchId,
      ...(payload.workspacePath
        ? { workspacePath: payload.workspacePath }
        : {}),
      userMessage: payload.message,
      options: {
        maxIterations: 4,
      },
    });

    await emitRunCompletion({
      result,
      events,
      runId,
      threadId,
      branchId,
      write,
    });
  } catch (error) {
    await write(
      createStreamEventEnvelope(
        createStreamEvent({
          type: "run.failed",
          runId,
          threadId,
          branchId,
          payload: {
            code: "runtime_error",
            message: error instanceof Error ? error.message : "Runtime failed.",
          },
        })
      )
    );
  }
}

async function emitRunCompletion(input: {
  result: RunTurnResult;
  events: AgentEvent[];
  runId: string;
  threadId: string;
  branchId: string;
  write: (value: unknown) => Promise<void>;
}) {
  if (input.result.finalMessage) {
    await input.write(
      createStreamEventEnvelope(
        createStreamEvent({
          type: "message.completed",
          runId: input.runId,
          threadId: input.threadId,
          branchId: input.branchId,
          payload: {
            message: input.result.finalMessage,
          },
        })
      )
    );
  }

  await input.write(
    createStreamEventEnvelope(
      createStreamEvent({
        type: "run.graph.updated",
        runId: input.runId,
        threadId: input.threadId,
        branchId: input.branchId,
        payload: {
          graph: buildRunGraph({
            events: input.events,
            runId: input.runId,
          }),
        },
      })
    )
  );
  await input.write(
    createStreamEventEnvelope(
      createStreamEvent({
        type: "run.completed",
        runId: input.runId,
        threadId: input.threadId,
        branchId: input.branchId,
        payload: {
          stopReason: input.result.stopReason,
          usage: input.result.usage,
        },
      })
    )
  );
}

function toRunStartPayload(
  payload: unknown
): RunStartCommandPayload | undefined {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload as RunStartCommandPayload;
  }

  return undefined;
}

function createRuntimeProfile(): AgentProfile {
  return {
    id: "coder",
    displayName: "Coder",
    role: "coder",
    systemPrompt: {
      promptId: "agent.coder.system",
    },
    model: {
      providerId: "scripted",
      modelId: "scripted-tool-then-answer",
    },
    allowedTools: ["echo_tool"],
    contextPolicy: {
      maxInputTokens: 4000,
      includeProjectInstructions: false,
      includeRecentMessages: true,
      includeMemory: false,
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

function toStreamEvent(input: {
  event: AgentEvent;
  runId: string;
  threadId: string;
  branchId: string;
  finalMessage: string;
}): AgentStreamEvent | undefined {
  if (input.event.type === "provider_text_delta") {
    const providerEvent = toProviderEvent(input.event.payload);

    if (providerEvent?.type === "text_delta") {
      return createStreamEvent({
        type: "message.delta",
        runId: input.runId,
        threadId: input.threadId,
        branchId: input.branchId,
        payload: {
          text: providerEvent.text,
        },
      });
    }
  }

  if (input.event.type === "context_built") {
    return createStreamEvent({
      type: "context.built",
      runId: input.runId,
      threadId: input.threadId,
      branchId: input.branchId,
      payload: toObject(input.event.payload),
    });
  }

  if (input.event.type === "tool_started") {
    const toolCall = toToolCall(toObject(input.event.payload)?.toolCall);

    return createStreamEvent({
      type: "tool.started",
      runId: input.runId,
      threadId: input.threadId,
      branchId: input.branchId,
      payload: {
        toolCallId: toolCall?.id ?? "",
        toolName: toolCall?.name ?? "unknown_tool",
        input: toolCall?.input,
      },
    });
  }

  if (input.event.type === "tool_finished") {
    const payload = toObject(input.event.payload);
    const result = toObject(payload?.result);

    return createStreamEvent({
      type: "tool.completed",
      runId: input.runId,
      threadId: input.threadId,
      branchId: input.branchId,
      payload: {
        toolCallId: String(payload?.toolCallId ?? ""),
        ok: result?.ok === true,
        summary:
          typeof result?.summary === "string" ? result.summary : undefined,
        error: result?.error,
      },
    });
  }

  return undefined;
}

function createStreamEvent(input: {
  type: AgentStreamEventType;
  runId: string;
  threadId: string;
  branchId: string;
  payload?: AgentStreamEvent["payload"];
}): AgentStreamEvent {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    runId: input.runId,
    threadId: input.threadId,
    branchId: input.branchId,
    createdAt: new Date().toISOString(),
    ...(input.payload ? { payload: input.payload } : {}),
  };
}

function toProviderEvent(payload: unknown): ModelEvent | undefined {
  const value = toObject(payload);

  if (value && "event" in value) {
    return value.event as ModelEvent;
  }

  return undefined;
}

function toToolCall(
  payload: unknown
): { id?: string; name?: string; input?: unknown } | undefined {
  if (typeof payload === "object" && payload !== null) {
    return payload as { id?: string; name?: string; input?: unknown };
  }

  return undefined;
}

function toObject(payload: unknown): Record<string, unknown> | undefined {
  if (typeof payload === "object" && payload !== null) {
    return payload as Record<string, unknown>;
  }

  return undefined;
}

class StreamingSessionStore extends InMemorySessionStore {
  private readonly onEvent: (event: AgentEvent) => Promise<void>;

  constructor(
    events: AgentEvent[],
    onEvent: (event: AgentEvent) => Promise<void>
  ) {
    super();
    this.onEvent = onEvent;
    this.eventsRef = events;
  }

  private readonly eventsRef: AgentEvent[];

  override async appendEvent(event: AgentEvent): Promise<void> {
    await super.appendEvent(event);
    this.eventsRef.push(event);
    await this.onEvent(event);
  }
}

class ScriptedRuntimeProvider implements ModelProvider {
  readonly id = "scripted";
  private requestCount = 0;

  async *createMessage(_request: ModelRequest): AsyncIterable<ModelEvent> {
    await Promise.resolve();
    this.requestCount += 1;

    if (this.requestCount === 1) {
      yield {
        type: "tool_call_done",
        toolCall: {
          id: "scripted-echo-tool-call",
          name: "echo_tool",
          input: {
            text: "hello from runtime rpc",
          },
        },
      };
      yield {
        type: "done",
        stopReason: "tool_use",
      };
      return;
    }

    yield {
      type: "text_delta",
      text: "Runtime RPC connected. ",
    };
    yield {
      type: "text_delta",
      text: "The Hono server is streaming agent-runtime events.",
    };
    yield {
      type: "usage",
      usage: {
        inputTokens: 1,
        outputTokens: 12,
        totalTokens: 13,
      },
    };
    yield {
      type: "done",
      stopReason: "end_turn",
    };
  }
}
