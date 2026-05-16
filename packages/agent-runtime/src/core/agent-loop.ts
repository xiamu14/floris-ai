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
  const maxIterations =
    input.options?.maxIterations ?? input.profile.stopPolicy.maxIterations;
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
      usage,
      iteration
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

    messages.push(createAssistantToolMessage(providerResult));

    for (const toolCall of providerResult.toolCalls) {
      const toolResult = await executeToolCall(
        deps,
        input,
        events,
        frameworkContext,
        toolCall
      );

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

async function consumeProviderEvents(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  request: ModelRequest,
  events: AgentEvent[],
  usage: TokenUsage,
  iteration: number
): Promise<{
  text: string;
  toolCalls: ModelToolCall[];
  stopReason: ModelStopReason;
  reasoningContent?: string;
}> {
  const toolCalls: ModelToolCall[] = [];
  let text = "";
  let reasoningContent: string | undefined;
  let stopReason: ModelStopReason = "end_turn";

  for await (const event of deps.provider.createMessage(
    request,
    input.signal
  )) {
    await appendProviderEvent(deps, events, input, event, iteration);

    if (event.type === "text_delta") {
      text += event.text;
    }

    if (event.type === "tool_call_done") {
      toolCalls.push(event.toolCall);
      if (event.reasoningContent) {
        reasoningContent = event.reasoningContent;
      }
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
    ...(reasoningContent ? { reasoningContent } : {}),
  };
}

async function executeToolCall(
  deps: AgentLoopDeps,
  input: RunTurnInput,
  events: AgentEvent[],
  frameworkContext: FrameworkContext,
  toolCall: ModelToolCall
): Promise<ToolResult> {
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
    maxContextTokens: deps.toolContextMaxTokens ?? 600,
  });

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
