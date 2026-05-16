import type { ChatCompletion } from "openai/resources/chat/completions";
import type {
  ModelDoneEvent,
  ModelEvent,
  ModelProviderError,
  ModelStopReason,
  ModelToolCall,
} from "../../types/provider.type";

export async function* toModelEvents(
  completion: ChatCompletion
): AsyncIterable<ModelEvent> {
  await Promise.resolve();

  const choice = completion.choices[0];

  if (!choice) {
    yield createErrorEvent({
      code: "empty_provider_response",
      message: "OpenAI-compatible provider returned no choices.",
      retryable: false,
    });
    return;
  }

  const content = choice.message.content;

  if (content) {
    yield {
      type: "text_delta",
      text: content,
    };
  }

  for (const toolCall of choice.message.tool_calls ?? []) {
    if (toolCall.type !== "function") {
      yield createErrorEvent({
        code: "unsupported_tool_call_type",
        message: `Unsupported tool call type "${toolCall.type}".`,
        retryable: false,
      });
      return;
    }

    const parsedToolCall = parseToolCall({
      id: toolCall.id,
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    });

    if (parsedToolCall instanceof Error) {
      yield createErrorEvent({
        code: "invalid_tool_call_arguments",
        message: parsedToolCall.message,
        retryable: false,
      });
      return;
    }

    yield {
      type: "tool_call_done",
      toolCall: parsedToolCall,
      ...getReasoningContent(choice.message),
    };
  }

  if (completion.usage) {
    yield {
      type: "usage",
      usage: {
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      },
    };
  }

  yield toDoneEvent(choice.finish_reason);
}

function getReasoningContent(message: unknown): { reasoningContent?: string } {
  if (
    typeof message === "object" &&
    message !== null &&
    "reasoning_content" in message &&
    typeof message.reasoning_content === "string"
  ) {
    return {
      reasoningContent: message.reasoning_content,
    };
  }

  return {};
}

export function toProviderError(error: unknown): ModelProviderError {
  if (isOpenAIErrorLike(error)) {
    const providerError: ModelProviderError = {
      code: "openai_provider_error",
      message: error.message,
      retryable: false,
    };

    if (error.status !== undefined) {
      providerError.status = error.status;
    }

    if (error.request_id !== undefined) {
      providerError.requestId = error.request_id;
    }

    if (error.error !== undefined) {
      providerError.details = error.error;
    }

    return providerError;
  }

  if (error instanceof Error) {
    return {
      code: "openai_provider_error",
      message: error.message,
      retryable: false,
    };
  }

  return {
    code: "openai_provider_error",
    message: String(error),
    retryable: false,
  };
}

function isOpenAIErrorLike(error: unknown): error is {
  message: string;
  status?: number;
  request_id?: string;
  error?: unknown;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    ("status" in error || "error" in error || "request_id" in error)
  );
}

export function createErrorEvent(error: ModelProviderError): ModelEvent {
  return {
    type: "error",
    error,
  };
}

function parseToolCall(toolCall: {
  id: string;
  name: string;
  arguments: string;
}): ModelToolCall | Error {
  try {
    return {
      id: toolCall.id,
      name: toolCall.name,
      input: JSON.parse(toolCall.arguments),
    };
  } catch (error) {
    return new Error(
      `Tool call "${toolCall.id}" returned invalid JSON arguments: ${String(error)}`
    );
  }
}

function toDoneEvent(
  finishReason: ChatCompletion.Choice["finish_reason"]
): ModelDoneEvent {
  return {
    type: "done",
    stopReason: toModelStopReason(finishReason),
  };
}

function toModelStopReason(
  finishReason: ChatCompletion.Choice["finish_reason"]
): ModelStopReason {
  if (finishReason === "tool_calls" || finishReason === "function_call") {
    return "tool_use";
  }

  if (finishReason === "length") {
    return "max_tokens";
  }

  if (finishReason === "content_filter") {
    return "provider_error";
  }

  return "end_turn";
}
