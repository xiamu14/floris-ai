import type { ContextBuildResult } from "../types/context.type";
import type {
  ModelMessage,
  ModelRequest,
  ModelStopReason,
} from "../types/provider.type";
import type {
  AgentLoopDeps,
  LoopStopReason,
  RunTurnInput,
  TokenUsage,
} from "../types/runtime.type";
import type { ToolResult } from "../types/tool.type";
import type {
  TraceRunHandle,
  TraceRunMetrics,
  TraceSpanHandle,
} from "../types/trace.type";

export function startAgentTraceRun(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  runId: string
): TraceRunHandle | undefined {
  return deps.traceRecorder?.startRun({
    runId,
    threadId: input.threadId,
    branchId: input.branchId,
    workspacePath: input.workspacePath ?? process.cwd(),
    profile: input.profile,
    userMessage: input.userMessage,
  });
}

export function startContextTraceSpan(
  traceRun: TraceRunHandle | undefined,
  iteration: number
): TraceSpanHandle | undefined {
  return traceRun?.startSpan({
    id: `context.${iteration}`,
    name: "context.build",
    kind: "context",
    attributes: {
      "floris.iteration": iteration,
    },
  });
}

export function finishContextTraceSpan(
  span: TraceSpanHandle | undefined,
  context: ContextBuildResult
): void {
  span?.finish({
    outputs: {
      tokenEstimate: context.tokenEstimate,
      messageCount: context.messages.length,
      systemSectionCount: context.system.length,
    },
    attributes: {
      "floris.context.token_estimate": context.tokenEstimate,
      "floris.context.message_count": context.messages.length,
      "floris.context.system_section_count": context.system.length,
    },
  });
}

export function startModelTraceSpan(
  traceRun: TraceRunHandle | undefined,
  iteration: number,
  request: ModelRequest
): TraceSpanHandle | undefined {
  return traceRun?.startSpan({
    id: `model.${iteration}`,
    name: "model.request",
    kind: "model",
    attributes: {
      "floris.iteration": iteration,
      "floris.provider_id": request.model.providerId,
      "floris.model_id": request.model.modelId,
      "floris.model.message_count": request.messages.length,
      "floris.model.tool_count": request.tools.length,
      ...(request.maxOutputTokens === undefined
        ? {}
        : { "floris.model.max_output_tokens": request.maxOutputTokens }),
    },
    inputs: {
      messageCount: request.messages.length,
      systemSectionCount: request.system.length,
      systemPreview: request.system.map((section) => previewText(section, 240)),
      messagesPreview: request.messages.map(toMessagePreview),
      toolNames: request.tools.map((tool) => tool.name),
      ...(request.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: request.maxOutputTokens }),
    },
  });
}

export function finishModelTraceSpan(
  span: TraceSpanHandle | undefined,
  result: {
    text: string;
    toolCalls: unknown[];
    stopReason: ModelStopReason;
    usage: TokenUsage;
  }
): void {
  span?.finish({
    status: result.stopReason === "provider_error" ? "error" : "ok",
    outputs: {
      stopReason: result.stopReason,
      textPreview: previewText(result.text, 3000),
      textTailPreview: tailPreviewText(result.text, 1000),
      textLength: result.text.length,
      toolCallCount: result.toolCalls.length,
      toolCallsPreview: result.toolCalls.map((toolCall) =>
        previewUnknown(toolCall, 500)
      ),
      usage: result.usage,
    },
    attributes: {
      "floris.provider.stop_reason": result.stopReason,
      "floris.provider.text_length": result.text.length,
      "floris.provider.tool_call_count": result.toolCalls.length,
      "floris.provider.usage.input_tokens": result.usage.inputTokens,
      "floris.provider.usage.output_tokens": result.usage.outputTokens,
      "floris.provider.usage.total_tokens": result.usage.totalTokens,
    },
  });
}

export function recordTraceProviderEvent(
  traceRun: TraceRunHandle | undefined,
  spanId: string | undefined,
  iteration: number,
  eventType: string,
  usage?: TokenUsage
): void {
  if (!(traceRun && spanId)) {
    return;
  }

  const input = {
    spanId,
    iteration,
    eventType,
    ...(usage ? { usage } : {}),
  };

  traceRun.recordProviderEvent(input);
}

export function startToolTraceSpan(
  traceRun: TraceRunHandle | undefined,
  iteration: number,
  toolCall: { id: string; name: string; input: unknown }
): TraceSpanHandle | undefined {
  return traceRun?.startSpan({
    id: `tool.${toolCall.id}`,
    parentId: `model.${iteration}`,
    name: `tool.${toolCall.name}`,
    kind: "tool",
    attributes: {
      "floris.iteration": iteration,
      "floris.tool_call_id": toolCall.id,
      "floris.tool.name": toolCall.name,
    },
    inputs: {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      inputPreview: previewUnknown(toolCall.input),
    },
  });
}

export function finishToolTraceSpan(
  span: TraceSpanHandle | undefined,
  result: ToolResult
): void {
  span?.finish({
    status: result.ok ? "ok" : "error",
    outputs: {
      summary: result.summary,
      contextPolicy: result.context.policy,
      ok: result.ok,
    },
    attributes: {
      "floris.tool.ok": result.ok,
      "floris.tool.filter_id": result.metrics.filterId,
      "floris.tool.strategy": result.metrics.strategy,
      "floris.tool.raw_tokens": result.metrics.estimatedRawTokens,
      "floris.tool.context_tokens": result.metrics.estimatedContextTokens,
      "floris.tool.reduction_ratio": result.metrics.reductionRatio,
      "floris.tool.truncated": result.metrics.truncated,
    },
  });
}

export async function finishTraceRun(
  deps: AgentLoopDeps,
  traceRun: TraceRunHandle | undefined,
  input: {
    stopReason: LoopStopReason;
    finalMessage: string;
    usage: TokenUsage;
    metrics: TraceRunMetrics;
  }
): Promise<void> {
  traceRun?.finish(input);
  await deps.traceRecorder?.flush();
}

function previewUnknown(value: unknown, maxLength = 500): string {
  const serialized = JSON.stringify(value, null, 2);
  const text = redactTraceText(
    typeof value === "string" ? value : (serialized ?? "")
  );

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function toMessagePreview(message: ModelMessage): {
  role: ModelMessage["role"];
  contentPreview: string;
  toolCallId?: string;
  toolCallNames?: string[];
  reasoningPreview?: string;
} {
  return {
    role: message.role,
    contentPreview: previewText(message.content, 600),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    ...(message.toolCalls
      ? { toolCallNames: message.toolCalls.map((toolCall) => toolCall.name) }
      : {}),
    ...(message.reasoningContent
      ? { reasoningPreview: previewText(message.reasoningContent, 240) }
      : {}),
  };
}

function previewText(value: string, maxLength: number): string {
  const redacted = redactTraceText(value);

  if (redacted.length <= maxLength) {
    return redacted;
  }

  return `${redacted.slice(0, maxLength)}...`;
}

function tailPreviewText(value: string, maxLength: number): string {
  const redacted = redactTraceText(value);

  if (redacted.length <= maxLength) {
    return redacted;
  }

  return `...${redacted.slice(-maxLength)}`;
}

function redactTraceText(value: string): string {
  return value
    .replace(
      /(api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi,
      "$1=[redacted]"
    )
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
}
