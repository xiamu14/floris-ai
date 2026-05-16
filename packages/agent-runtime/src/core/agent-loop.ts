import {
  runContextKey,
  toolArtifactStoreKey,
  toolResultPolicyKey,
} from "../context/context-keys";
import { createFrameworkContext } from "../context/framework-context";
import { createToolExecutionContext } from "../context/scenarios/tool-execution-context";
import { defaultToolResultPolicy } from "../tools/tool-result-policy";
import type { FrameworkContext } from "../types/framework-context.type";
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
import type { TraceRunHandle } from "../types/trace.type";
import {
  finishContextTraceSpan,
  finishModelTraceSpan,
  finishToolTraceSpan,
  finishTraceRun,
  recordTraceProviderEvent,
  startAgentTraceRun,
  startContextTraceSpan,
  startModelTraceSpan,
  startToolTraceSpan,
} from "./agent-loop-trace";

const DEFAULT_CODE_AGENT_MAX_OUTPUT_TOKENS = 4096;
const DEFAULT_TOOL_CONTEXT_MAX_TOKENS = 1600;
const FINAL_SYNTHESIS_MAX_OUTPUT_TOKENS = 8192;

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
  const frameworkContext = createAgentRunFrameworkContext(deps, input);
  const traceRun = startAgentTraceRun(deps, input, crypto.randomUUID());
  const maxIterations =
    input.options?.maxIterations ?? input.profile.stopPolicy.maxIterations;
  const shouldForceSynthesis =
    input.options?.forceSynthesisOnMaxIterations ?? true;
  let finalMessage = "";

  await appendEvent(deps, events, input, "user_message", {
    content: input.userMessage,
  });
  await appendEvent(deps, events, input, "framework_context_created", {
    entries: frameworkContext.describe(),
  });

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (input.signal?.aborted) {
      await appendEvent(deps, events, input, "stop", {
        stopReason: "user_interrupted",
      });

      return toResult(
        deps,
        input,
        events,
        usage,
        "user_interrupted",
        finalMessage,
        traceRun
      );
    }

    const providerResult = await requestModelForIteration(
      deps,
      input,
      events,
      usage,
      messages,
      traceRun,
      iteration,
      deps.toolRegistry.listDefinitions(input.profile.allowedTools)
    );

    finalMessage += providerResult.text;
    const stopReason = getProviderStopReason(providerResult);

    if (stopReason) {
      await appendEvent(deps, events, input, "stop", {
        stopReason,
      });

      return toResult(
        deps,
        input,
        events,
        usage,
        stopReason,
        finalMessage,
        traceRun
      );
    }

    messages.push(createAssistantToolMessage(providerResult));
    const toolsOk = await executeToolCallsForIteration(
      deps,
      input,
      events,
      frameworkContext,
      messages,
      providerResult.toolCalls,
      traceRun,
      iteration
    );

    if (!toolsOk) {
      return toResult(
        deps,
        input,
        events,
        usage,
        "tool_error",
        finalMessage,
        traceRun
      );
    }
  }

  if (shouldForceSynthesis && messages.length > 1 && !input.signal?.aborted) {
    return forceSynthesisAfterMaxIterations(
      deps,
      input,
      events,
      usage,
      messages,
      traceRun,
      maxIterations,
      finalMessage
    );
  }

  await appendEvent(deps, events, input, "stop", {
    stopReason: "max_iterations",
  });

  return toResult(
    deps,
    input,
    events,
    usage,
    "max_iterations",
    finalMessage,
    traceRun
  );
}

function getProviderStopReason(providerResult: {
  stopReason: ModelStopReason;
  toolCalls: ModelToolCall[];
}): RunTurnResult["stopReason"] | undefined {
  if (providerResult.stopReason === "provider_error") {
    return "provider_error";
  }

  if (
    providerResult.stopReason === "max_tokens" &&
    providerResult.toolCalls.length === 0
  ) {
    return "provider_max_tokens";
  }

  if (providerResult.toolCalls.length === 0) {
    return "assistant_done";
  }

  return undefined;
}

async function requestModelForIteration(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  events: AgentEvent[],
  usage: TokenUsage,
  messages: ModelMessage[],
  traceRun: TraceRunHandle | undefined,
  iteration: number,
  tools: ModelRequest["tools"]
) {
  const contextSpan = startContextTraceSpan(traceRun, iteration);
  const context = await deps.contextBuilder.build({
    profile: input.profile,
    threadId: input.threadId,
    branchId: input.branchId,
    messages,
  });
  finishContextTraceSpan(contextSpan, context);
  const request: ModelRequest = {
    model: input.profile.model,
    system: context.system,
    messages: context.messages,
    tools,
    maxOutputTokens: DEFAULT_CODE_AGENT_MAX_OUTPUT_TOKENS,
  };

  await appendEvent(deps, events, input, "context_built", {
    tokenEstimate: context.tokenEstimate,
  });
  await appendEvent(deps, events, input, "model_request_started", {
    iteration,
    model: input.profile.model,
    ...(tools.length === 0 ? { toolScope: "none" } : {}),
  });

  const modelSpan = startModelTraceSpan(traceRun, iteration, request);
  const providerResult = await consumeProviderEvents(
    deps,
    input,
    request,
    events,
    usage,
    iteration,
    traceRun,
    modelSpan?.id
  );
  finishModelTraceSpan(modelSpan, providerResult);

  return providerResult;
}

async function executeToolCallsForIteration(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  events: AgentEvent[],
  frameworkContext: FrameworkContext,
  messages: ModelMessage[],
  toolCalls: ModelToolCall[],
  traceRun: TraceRunHandle | undefined,
  iteration: number
): Promise<boolean> {
  for (const toolCall of toolCalls) {
    const toolResult = await executeToolCall(
      deps,
      input,
      events,
      frameworkContext,
      toolCall,
      traceRun,
      iteration
    );

    messages.push({
      role: "tool",
      content: toolResultToContent(toolResult),
      toolCallId: toolCall.id,
    });

    if (!(toolResult.ok || toolResult.error.recoverable)) {
      return false;
    }
  }

  return true;
}

async function forceSynthesisAfterMaxIterations(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  events: AgentEvent[],
  usage: TokenUsage,
  messages: ModelMessage[],
  traceRun: TraceRunHandle | undefined,
  iteration: number,
  previousFinalMessage: string
): Promise<RunTurnResult> {
  const synthesisMessages = [
    ...messages,
    {
      role: "user" as const,
      content: [
        "Tool budget is exhausted.",
        "Do not call more tools.",
        "Use only the observations already in this conversation to produce the best concise final answer.",
        "If some details are uncertain, state the uncertainty directly.",
      ].join("\n"),
    },
  ];
  const contextSpan = startContextTraceSpan(traceRun, iteration);
  const context = await deps.contextBuilder.build({
    profile: input.profile,
    threadId: input.threadId,
    branchId: input.branchId,
    messages: synthesisMessages,
  });
  finishContextTraceSpan(contextSpan, context);
  const request: ModelRequest = {
    model: input.profile.model,
    system: context.system,
    messages: context.messages,
    tools: [],
    maxOutputTokens: FINAL_SYNTHESIS_MAX_OUTPUT_TOKENS,
  };

  await appendEvent(deps, events, input, "forced_synthesis_started", {
    reason: "max_iterations",
    iteration,
  });
  await appendEvent(deps, events, input, "context_built", {
    tokenEstimate: context.tokenEstimate,
  });
  await appendEvent(deps, events, input, "model_request_started", {
    iteration,
    model: input.profile.model,
    toolScope: "none",
  });

  const modelSpan = startModelTraceSpan(traceRun, iteration, request);
  const providerResult = await consumeProviderEvents(
    deps,
    input,
    request,
    events,
    usage,
    iteration,
    traceRun,
    modelSpan?.id
  );
  finishModelTraceSpan(modelSpan, providerResult);

  const finalMessage = previousFinalMessage + providerResult.text;

  if (providerResult.stopReason === "provider_error") {
    return toResult(
      deps,
      input,
      events,
      usage,
      "provider_error",
      finalMessage,
      traceRun
    );
  }

  if (providerResult.stopReason === "max_tokens") {
    await appendEvent(deps, events, input, "stop", {
      stopReason: "provider_max_tokens",
      phase: "forced_synthesis",
    });

    return toResult(
      deps,
      input,
      events,
      usage,
      "provider_max_tokens",
      finalMessage,
      traceRun
    );
  }

  await appendEvent(deps, events, input, "stop", {
    stopReason: "assistant_done",
    phase: "forced_synthesis",
  });

  return toResult(
    deps,
    input,
    events,
    usage,
    "assistant_done",
    finalMessage,
    traceRun
  );
}

function createAgentRunFrameworkContext(
  deps: AgentLoopDeps,
  input: RunTurnInput
): FrameworkContext {
  let frameworkContext = createFrameworkContext()
    .set(runContextKey, {
      threadId: input.threadId,
      branchId: input.branchId,
      agentId: input.profile.id,
      workspacePath: input.workspacePath ?? process.cwd(),
    })
    .set(toolResultPolicyKey, defaultToolResultPolicy);

  if (deps.toolOutputArtifactStore) {
    frameworkContext = frameworkContext.set(
      toolArtifactStoreKey,
      deps.toolOutputArtifactStore
    );
  }

  return frameworkContext;
}

function createAssistantToolMessage(providerResult: {
  text: string;
  toolCalls: ModelToolCall[];
  reasoningContent?: string;
}): ModelMessage {
  if (providerResult.reasoningContent) {
    return {
      role: "assistant",
      content: providerResult.text,
      reasoningContent: providerResult.reasoningContent,
      toolCalls: providerResult.toolCalls,
    };
  }

  return {
    role: "assistant",
    content: providerResult.text,
    toolCalls: providerResult.toolCalls,
  };
}

function consumeProviderEvent(
  event: ModelEvent,
  toolCalls: ModelToolCall[],
  usage: TokenUsage,
  requestUsage: TokenUsage,
  state: {
    reasoningContent: string | undefined;
    stopReason: ModelStopReason;
    text: string;
  }
): {
  reasoningContent: string | undefined;
  stopReason: ModelStopReason;
  text: string;
} {
  switch (event.type) {
    case "text_delta":
      return {
        ...state,
        text: state.text + event.text,
      };
    case "tool_call_done":
      toolCalls.push(event.toolCall);
      return {
        ...state,
        ...(event.reasoningContent
          ? { reasoningContent: event.reasoningContent }
          : {}),
      };
    case "usage":
      usage.inputTokens += event.usage.inputTokens;
      usage.outputTokens += event.usage.outputTokens;
      usage.totalTokens += event.usage.totalTokens;
      requestUsage.inputTokens += event.usage.inputTokens;
      requestUsage.outputTokens += event.usage.outputTokens;
      requestUsage.totalTokens += event.usage.totalTokens;
      return state;
    case "done":
      return {
        ...state,
        stopReason: event.stopReason,
      };
    case "error":
      return {
        ...state,
        stopReason: "provider_error",
      };
    default:
      return state;
  }
}

async function consumeProviderEvents(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  request: ModelRequest,
  events: AgentEvent[],
  usage: TokenUsage,
  iteration: number,
  traceRun?: TraceRunHandle,
  traceSpanId?: string
): Promise<{
  text: string;
  toolCalls: ModelToolCall[];
  stopReason: ModelStopReason;
  usage: TokenUsage;
  reasoningContent?: string;
}> {
  const toolCalls: ModelToolCall[] = [];
  const requestUsage = createEmptyUsage();
  let text = "";
  let reasoningContent: string | undefined;
  let stopReason: ModelStopReason = "end_turn";

  for await (const event of deps.provider.createMessage(
    request,
    input.signal
  )) {
    recordTraceProviderEvent(
      traceRun,
      traceSpanId,
      iteration,
      event.type,
      event.type === "usage" ? event.usage : undefined
    );
    await appendProviderEvent(deps, events, input, event, iteration);
    ({ reasoningContent, stopReason, text } = consumeProviderEvent(
      event,
      toolCalls,
      usage,
      requestUsage,
      { reasoningContent, stopReason, text }
    ));
  }

  return {
    text,
    toolCalls,
    stopReason,
    usage: requestUsage,
    ...(reasoningContent ? { reasoningContent } : {}),
  };
}

async function executeToolCall(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  events: AgentEvent[],
  frameworkContext: FrameworkContext,
  toolCall: ModelToolCall,
  traceRun: TraceRunHandle | undefined,
  iteration: number
): Promise<ToolResult> {
  const toolSpan = startToolTraceSpan(traceRun, iteration, toolCall);
  await appendEvent(deps, events, input, "tool_started", {
    toolCall,
  });

  const toolContext = createToolExecutionContext(frameworkContext);
  const rawResult = await deps.toolRegistry.execute(
    toolCall.name,
    toolCall.input,
    toolContext
  );
  const policyResult = toolContext.resultPolicy.apply({
    result: rawResult,
    maxContextTokens:
      deps.toolContextMaxTokens ?? DEFAULT_TOOL_CONTEXT_MAX_TOKENS,
  });
  finishToolTraceSpan(toolSpan, policyResult.result);

  await appendEvent(deps, events, input, "tool_finished", {
    toolCallId: toolCall.id,
    result: policyResult.result,
    outputFiltering: {
      domainFilter: policyResult.result.metrics.filterId,
      strategy: policyResult.result.metrics.strategy,
      rawTokens: policyResult.result.metrics.estimatedRawTokens,
      contextTokens: policyResult.result.metrics.estimatedContextTokens,
      reductionRatio: policyResult.result.metrics.reductionRatio,
      truncated: policyResult.result.metrics.truncated,
      rawRef: policyResult.result.artifacts.at(0)?.ref,
      warnings: policyResult.warnings,
    },
  });

  return policyResult.result;
}

function toolResultToContent(result: ToolResult): string {
  if (result.ok) {
    return result.context.content;
  }

  return result.context.content;
}

async function appendProviderEvent(
  deps: AgentLoopDeps,
  events: AgentEvent[],
  input: RunTurnInput,
  event: ModelEvent,
  iteration: number
): Promise<void> {
  await appendEvent(deps, events, input, `provider_${event.type}`, {
    iteration,
    event,
  });
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

async function toResult(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  events: AgentEvent[],
  usage: TokenUsage,
  stopReason: RunTurnResult["stopReason"],
  finalMessage: string,
  traceRun?: TraceRunHandle
): Promise<RunTurnResult> {
  await finishTraceRun(deps, traceRun, {
    stopReason,
    finalMessage,
    usage,
    metrics: createTraceRunMetrics(events),
  });

  return {
    threadId: input.threadId,
    branchId: input.branchId,
    stopReason,
    events,
    usage,
    finalMessage,
  };
}

function createTraceRunMetrics(events: AgentEvent[]): {
  contextBuildCount: number;
  modelRequestCount: number;
  toolCallCount: number;
} {
  return {
    contextBuildCount: events.filter((event) => event.type === "context_built")
      .length,
    modelRequestCount: events.filter(
      (event) => event.type === "model_request_started"
    ).length,
    toolCallCount: events.filter((event) => event.type === "tool_finished")
      .length,
  };
}
