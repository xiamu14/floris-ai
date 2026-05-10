import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { ModelParameters, ModelRequest } from "../../types/provider.type";

export function toOpenAIChatCompletionRequest(
  request: ModelRequest,
  modelId: string,
  modelParameters: ModelParameters | undefined
): ChatCompletionCreateParamsNonStreaming {
  const body: ChatCompletionCreateParamsNonStreaming = {
    model: modelId,
    messages: toOpenAIMessages(request),
    stream: false,
    ...toOpenAIParameters(modelParameters),
    ...toOpenAIParameters(request.parameters),
    ...toOpenAIMaxTokens(request),
  };
  const tools = toOpenAITools(request);

  if (tools) {
    body.tools = tools;
  }

  return body;
}

function toOpenAIMessages(request: ModelRequest): ChatCompletionMessageParam[] {
  return [
    ...request.system.map((content) => ({
      role: "system" as const,
      content,
    })),
    ...request.messages.map((message) => {
      if (message.role === "tool") {
        const toolMessage: ChatCompletionMessageParam = {
          role: "tool" as const,
          content: message.content,
          tool_call_id: message.toolCallId ?? "",
        };

        return toolMessage;
      }

      if (message.role === "assistant" && message.toolCalls) {
        const assistantMessage: ChatCompletionAssistantMessageParam = {
          role: "assistant",
          content: message.content || null,
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
      };
    }),
  ];
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
  parameters: ModelParameters | undefined
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
