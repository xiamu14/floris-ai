import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { ModelRequest } from "../../types/provider.type";
import type { ProviderRequestContext } from "../../types/provider-request-context.type";

export function toOpenAIChatCompletionRequest(
  request: ModelRequest,
  context: ProviderRequestContext
): ChatCompletionCreateParamsNonStreaming {
  const body: ChatCompletionCreateParamsNonStreaming = {
    model: context.modelId,
    messages: toOpenAIMessages(request, context),
    stream: false,
    ...toOpenAIParameters(context.modelParameters),
    ...toOpenAIParameters(request.parameters),
    ...toOpenAIMaxTokens(request),
  };
  const tools = toOpenAITools(request);

  if (tools) {
    body.tools = tools;
  }

  return body;
}

function toOpenAIMessages(
  request: ModelRequest,
  context: ProviderRequestContext
): ChatCompletionMessageParam[] {
  const toolResultMessageRole =
    context.compatibility?.toolResultMessageRole ?? "tool";

  return [
    ...request.system.map((content) => ({
      role: "system" as const,
      content,
    })),
    ...request.messages.map((message) => {
      if (message.role === "tool") {
        if (toolResultMessageRole === "user") {
          return {
            role: "user" as const,
            content: formatToolResultAsUserMessage(message),
          };
        }

        const toolMessage: ChatCompletionMessageParam = {
          role: "tool" as const,
          content: message.content,
          tool_call_id: message.toolCallId ?? "",
        };

        return toolMessage;
      }

      if (message.role === "assistant" && message.toolCalls) {
        const assistantMessage: ChatCompletionAssistantMessageParam & {
          reasoning_content?: string;
        } = {
          role: "assistant",
          content: message.content || "",
          ...(message.reasoningContent
            ? { reasoning_content: message.reasoningContent }
            : {}),
          tool_calls: message.toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.input),
            },
          })),
        };

        return assistantMessage;
      }

      return {
        role: message.role,
        content: message.content,
      } as ChatCompletionMessageParam;
    }),
  ];
}

function formatToolResultAsUserMessage(message: {
  content: string;
  toolCallId?: string;
}): string {
  return [
    "Tool result:",
    `tool_call_id: ${message.toolCallId ?? "unknown"}`,
    message.content,
  ].join("\n");
}

function toOpenAITools(
  request: ModelRequest
): ChatCompletionTool[] | undefined {
  if (request.tools.length === 0) {
    return undefined;
  }

  return request.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as Record<string, unknown>,
    },
  }));
}

function toOpenAIParameters(
  parameters: ProviderRequestContext["modelParameters"]
): Partial<ChatCompletionCreateParamsNonStreaming> {
  if (!parameters) {
    return {};
  }

  const openAIParameters: Partial<ChatCompletionCreateParamsNonStreaming> = {};

  if (parameters.maxCompletionTokens !== undefined) {
    openAIParameters.max_completion_tokens = parameters.maxCompletionTokens;
  }

  if (parameters.temperature !== undefined) {
    openAIParameters.temperature = parameters.temperature;
  }

  if (parameters.topP !== undefined) {
    openAIParameters.top_p = parameters.topP;
  }

  if (parameters.frequencyPenalty !== undefined) {
    openAIParameters.frequency_penalty = parameters.frequencyPenalty;
  }

  if (parameters.presencePenalty !== undefined) {
    openAIParameters.presence_penalty = parameters.presencePenalty;
  }

  if (parameters.stop !== undefined) {
    openAIParameters.stop = parameters.stop;
  }

  return openAIParameters;
}

function toOpenAIMaxTokens(
  request: ModelRequest
): Partial<ChatCompletionCreateParamsNonStreaming> {
  if (request.maxOutputTokens === undefined) {
    return {};
  }

  return {
    max_completion_tokens: request.maxOutputTokens,
  };
}
