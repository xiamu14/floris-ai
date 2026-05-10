import type {
  ModelEvent,
  ModelMessage,
  ModelRequest,
  ModelStopReason,
  ModelToolCall,
} from "../types/provider.type";
import type {
  AgentEvent,
  AgentLoopDeps,
  RunTurnInput,
  RunTurnResult,
  TokenUsage,
} from "../types/runtime.type";
import type { ToolResult } from "../types/tool.type";

export class AgentLoop {
  private readonly deps: AgentLoopDeps;

  constructor(deps: AgentLoopDeps) {
    this.deps = deps;
  }

  runTurn(input: RunTurnInput): Promise<RunTurnResult> {
    return runAgentTurn(this.deps, input);
  }
}

async function runAgentTurn(
  deps: AgentLoopDeps,
  input: RunTurnInput
): Promise<RunTurnResult> {
  const events: AgentEvent[] = [];
  const messages: ModelMessage[] = [
    {
      role: "user",
      content: input.userMessage,
    },
  ];
  const usage = createEmptyUsage();
  const maxIterations =
    input.options?.maxIterations ?? input.profile.stopPolicy.maxIterations;
  let finalMessage = "";

  await appendEvent(deps, events, input, "user_message", {
    content: input.userMessage,
  });

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (input.signal?.aborted) {
      await appendEvent(deps, events, input, "stop", {
        stopReason: "user_interrupted",
      });

      return toResult(input, events, usage, "user_interrupted", finalMessage);
    }

    const context = await deps.contextBuilder.build({
      profile: input.profile,
      threadId: input.threadId,
      branchId: input.branchId,
      messages,
    });
    const request: ModelRequest = {
      model: input.profile.model,
      system: context.system,
      messages: context.messages,
      tools: deps.toolRegistry.listDefinitions(input.profile.allowedTools),
    };

    await appendEvent(deps, events, input, "context_built", {
      tokenEstimate: context.tokenEstimate,
    });
    await appendEvent(deps, events, input, "model_request_started", {
      iteration,
      model: input.profile.model,
    });

    const providerResult = await consumeProviderEvents(
      deps,
      input,
      request,
      events,
      usage
    );

    finalMessage += providerResult.text;

    if (providerResult.stopReason === "provider_error") {
      return toResult(input, events, usage, "provider_error", finalMessage);
    }

    if (providerResult.toolCalls.length === 0) {
      await appendEvent(deps, events, input, "stop", {
        stopReason: "assistant_done",
      });

      return toResult(input, events, usage, "assistant_done", finalMessage);
    }

    messages.push({
      role: "assistant",
      content: providerResult.text,
      toolCalls: providerResult.toolCalls,
    });

    for (const toolCall of providerResult.toolCalls) {
      const toolResult = await executeToolCall(deps, input, events, toolCall);

      messages.push({
        role: "tool",
        content: toolResultToContent(toolResult),
        toolCallId: toolCall.id,
      });

      if (toolResult.ok || toolResult.error.recoverable) {
        continue;
      }

      return toResult(input, events, usage, "tool_error", finalMessage);
    }
  }

  await appendEvent(deps, events, input, "stop", {
    stopReason: "max_iterations",
  });

  return toResult(input, events, usage, "max_iterations", finalMessage);
}

async function consumeProviderEvents(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  request: ModelRequest,
  events: AgentEvent[],
  usage: TokenUsage
): Promise<{
  text: string;
  toolCalls: ModelToolCall[];
  stopReason: ModelStopReason;
}> {
  const toolCalls: ModelToolCall[] = [];
  let text = "";
  let stopReason: ModelStopReason = "end_turn";

  for await (const event of deps.provider.createMessage(
    request,
    input.signal
  )) {
    await appendProviderEvent(deps, events, input, event);

    if (event.type === "text_delta") {
      text += event.text;
    }

    if (event.type === "tool_call_done") {
      toolCalls.push(event.toolCall);
    }

    if (event.type === "usage") {
      usage.inputTokens += event.usage.inputTokens;
      usage.outputTokens += event.usage.outputTokens;
      usage.totalTokens += event.usage.totalTokens;
    }

    if (event.type === "done") {
      stopReason = event.stopReason;
    }

    if (event.type === "error") {
      stopReason = "provider_error";
    }
  }

  return {
    text,
    toolCalls,
    stopReason,
  };
}

async function executeToolCall(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  events: AgentEvent[],
  toolCall: ModelToolCall
): Promise<ToolResult> {
  await appendEvent(deps, events, input, "tool_started", {
    toolCall,
  });

  const result = await deps.toolRegistry.execute(
    toolCall.name,
    toolCall.input,
    {
      threadId: input.threadId,
      branchId: input.branchId,
    }
  );

  await appendEvent(deps, events, input, "tool_finished", {
    toolCallId: toolCall.id,
    result,
  });

  return result;
}

function toolResultToContent(result: ToolResult): string {
  if (result.ok) {
    return result.content;
  }

  return `Tool error: ${result.error.message}`;
}

async function appendProviderEvent(
  deps: AgentLoopDeps,
  events: AgentEvent[],
  input: RunTurnInput,
  event: ModelEvent
): Promise<void> {
  await appendEvent(deps, events, input, `provider_${event.type}`, event);
}

async function appendEvent(
  deps: AgentLoopDeps,
  events: AgentEvent[],
  input: RunTurnInput,
  type: string,
  payload?: unknown
): Promise<void> {
  const event: AgentEvent = {
    id: crypto.randomUUID(),
    type,
    threadId: input.threadId,
    branchId: input.branchId,
    createdAt: new Date().toISOString(),
    payload,
  };

  events.push(event);
  await deps.sessionStore?.append(event);
}

function createEmptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

function toResult(
  input: RunTurnInput,
  events: AgentEvent[],
  usage: TokenUsage,
  stopReason: RunTurnResult["stopReason"],
  finalMessage: string
): RunTurnResult {
  return {
    threadId: input.threadId,
    branchId: input.branchId,
    stopReason,
    events,
    usage,
    finalMessage,
  };
}
