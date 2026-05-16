import {
  flushTraces,
  init,
  type LiveSpan,
  SpanStatusCode,
  SpanType,
  startSpan,
} from "mlflow-tracing";
import type {
  MlflowTraceRecorderOptions,
  TraceProviderEventInput,
  TraceRunFinishInput,
  TraceRunHandle,
  TraceRunStartInput,
  TraceSpanFinishInput,
  TraceSpanHandle,
  TraceSpanKind,
  TraceSpanStartInput,
} from "../types/trace.type";

export class MlflowTraceRecorder {
  private readonly options: MlflowTraceRecorderOptions;

  constructor(options: MlflowTraceRecorderOptions) {
    this.options = options;
    init({
      trackingUri: options.trackingUri,
      experimentId: options.experimentId,
    });
  }

  startRun(input: TraceRunStartInput): TraceRunHandle {
    const rootSpan = startSpan({
      name: "agent.run",
      spanType: SpanType.AGENT,
      inputs: {
        userMessagePreview: preview(input.userMessage, 1000),
        userMessageLength: input.userMessage.length,
      },
      attributes: {
        "floris.run_id": input.runId,
        "floris.thread_id": input.threadId,
        "floris.branch_id": input.branchId,
        "floris.agent_id": input.profile.id,
        "floris.agent_role": input.profile.role,
        "floris.workspace_path": input.workspacePath,
        "floris.source_name": this.options.sourceName ?? "agent-runtime",
      },
    });

    return new MlflowTraceRunHandle(rootSpan);
  }

  flush(): Promise<void> {
    return flushTraces();
  }
}

class MlflowTraceRunHandle implements TraceRunHandle {
  private readonly rootSpan: LiveSpan;
  private readonly spans = new Map<string, LiveSpan>();

  constructor(rootSpan: LiveSpan) {
    this.rootSpan = rootSpan;
    this.spans.set("agent.run", rootSpan);
  }

  startSpan(input: TraceSpanStartInput): TraceSpanHandle {
    const parent = input.parentId
      ? this.spans.get(input.parentId)
      : this.rootSpan;
    const span = startSpan({
      name: input.name,
      spanType: toMlflowSpanType(input.kind),
      ...(input.inputs === undefined ? {} : { inputs: input.inputs }),
      ...(input.attributes ? { attributes: input.attributes } : {}),
      ...(parent ? { parent } : {}),
    });

    this.spans.set(input.id, span);

    return {
      id: input.id,
      finish: (finishInput?: TraceSpanFinishInput) => {
        span.end({
          ...(finishInput?.outputs === undefined
            ? {}
            : { outputs: finishInput.outputs }),
          ...(finishInput?.attributes
            ? { attributes: finishInput.attributes }
            : {}),
          status:
            finishInput?.status === "error"
              ? SpanStatusCode.ERROR
              : SpanStatusCode.OK,
        });
      },
    };
  }

  recordProviderEvent(input: TraceProviderEventInput): void {
    const span = this.spans.get(input.spanId);

    if (!span) {
      return;
    }

    const countKey = `floris.provider_event.${input.eventType}.count`;
    const currentCount = span.getAttribute(countKey);
    span.setAttribute(
      countKey,
      typeof currentCount === "number" ? currentCount + 1 : 1
    );
    span.setAttribute("floris.provider_event.last_type", input.eventType);
    span.setAttribute("floris.provider_event.last_iteration", input.iteration);

    if (input.usage) {
      span.setAttribute(
        "floris.provider.usage.input_tokens",
        input.usage.inputTokens
      );
      span.setAttribute(
        "floris.provider.usage.output_tokens",
        input.usage.outputTokens
      );
      span.setAttribute(
        "floris.provider.usage.total_tokens",
        input.usage.totalTokens
      );
    }
  }

  finish(input: TraceRunFinishInput): void {
    this.rootSpan.end({
      outputs: {
        finalMessagePreview: preview(input.finalMessage, 4000),
        finalMessageTailPreview: tailPreview(input.finalMessage, 1200),
        finalMessageLength: input.finalMessage.length,
        stopReason: input.stopReason,
        usage: input.usage,
        metrics: input.metrics,
      },
      attributes: {
        "floris.stop_reason": input.stopReason,
        "floris.usage.input_tokens": input.usage.inputTokens,
        "floris.usage.output_tokens": input.usage.outputTokens,
        "floris.usage.total_tokens": input.usage.totalTokens,
        "floris.metrics.context_build_count": input.metrics.contextBuildCount,
        "floris.metrics.model_request_count": input.metrics.modelRequestCount,
        "floris.metrics.tool_call_count": input.metrics.toolCallCount,
      },
      status:
        input.stopReason === "assistant_done" ||
        input.stopReason === "max_iterations"
          ? SpanStatusCode.OK
          : SpanStatusCode.ERROR,
    });
  }
}

function toMlflowSpanType(kind: TraceSpanKind): SpanType {
  switch (kind) {
    case "agent":
      return SpanType.AGENT;
    case "model":
      return SpanType.CHAT_MODEL;
    case "tool":
      return SpanType.TOOL;
    case "context":
    case "filter":
      return SpanType.CHAIN;
    default:
      return SpanType.UNKNOWN;
  }
}

function preview(value: string, maxLength = 500): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function tailPreview(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `...${value.slice(-maxLength)}`;
}
