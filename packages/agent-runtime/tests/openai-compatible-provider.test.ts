import { describe, expect, it } from "vitest";
import {
  createOpenAICompatibleProvider,
  OpenAICompatibleModelProvider,
} from "../src/providers/openai-compatible-provider";
import type {
  ModelEvent,
  ModelRequest,
  OpenAIChatCompletionsClient,
} from "../src/types/provider.type";

const request: ModelRequest = {
  model: {
    providerId: "compatible",
    modelId: "provider-model",
  },
  system: ["You are a coding agent."],
  messages: [
    {
      role: "user",
      content: "Say hello",
    },
  ],
  tools: [
    {
      name: "echo_tool",
      description: "Echo input.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
    },
  ],
  maxOutputTokens: 128,
};

describe("OpenAI-compatible provider", () => {
  it("calls the OpenAI SDK with provider-configured model params", async () => {
    const calls: unknown[] = [];
    const provider = new OpenAICompatibleModelProvider(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
        },
        modelConfig: {
          providerId: "compatible",
          modelId: "provider-model",
          parameters: {
            maxCompletionTokens: 1024,
            temperature: 1,
            topP: 0.95,
            frequencyPenalty: 0,
            presencePenalty: 0,
            stop: null,
          },
        },
      },
      {
        client: createMockClient(calls, {
          choices: [
            {
              index: 0,
              logprobs: null,
              message: {
                role: "assistant",
                content: "hello",
                refusal: null,
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 2,
            total_tokens: 12,
          },
        }),
      }
    );

    const events = await collect(provider.createMessage(request));

    expect(calls[0]).toEqual({
      model: "provider-model",
      messages: [
        {
          role: "system",
          content: "You are a coding agent.",
        },
        {
          role: "user",
          content: "Say hello",
        },
      ],
      stream: false,
      max_completion_tokens: 128,
      temperature: 1,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: null,
      tools: [
        {
          type: "function",
          function: {
            name: "echo_tool",
            description: "Echo input.",
            parameters: {
              type: "object",
              properties: {
                text: { type: "string" },
              },
              required: ["text"],
            },
          },
        },
      ],
    });
    expect(events).toEqual([
      {
        type: "text_delta",
        text: "hello",
      },
      {
        type: "usage",
        usage: {
          inputTokens: 10,
          outputTokens: 2,
          totalTokens: 12,
        },
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
  });

  it("maps SDK tool calls to internal tool_call_done events", async () => {
    const provider = new OpenAICompatibleModelProvider(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
        },
        modelConfig: {
          providerId: "compatible",
          modelId: "provider-model",
        },
      },
      {
        client: createMockClient([], {
          choices: [
            {
              index: 0,
              logprobs: null,
              message: {
                role: "assistant",
                content: null,
                refusal: null,
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "echo_tool",
                      arguments: JSON.stringify({ text: "hello" }),
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        }),
      }
    );

    expect(await collect(provider.createMessage(request))).toEqual([
      {
        type: "tool_call_done",
        toolCall: {
          id: "call_1",
          name: "echo_tool",
          input: {
            text: "hello",
          },
        },
      },
      {
        type: "done",
        stopReason: "tool_use",
      },
    ]);
  });

  it("uses an explicitly provided API key when it creates the SDK client", async () => {
    await Promise.resolve();

    const provider = new OpenAICompatibleModelProvider(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
        },
        modelConfig: {
          providerId: "compatible",
          modelId: "provider-model",
        },
      },
      {
        apiKey: "test-key",
      }
    );

    expect(provider.id).toBe("compatible");
  });

  it("does not read api keys inside the provider when a client is injected", async () => {
    const provider = new OpenAICompatibleModelProvider(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
        },
        modelConfig: {
          providerId: "compatible",
          modelId: "provider-model",
        },
      },
      {
        client: createMockClient([], {
          choices: [
            {
              index: 0,
              logprobs: null,
              message: {
                role: "assistant",
                content: "ok",
                refusal: null,
              },
              finish_reason: "stop",
            },
          ],
        }),
      }
    );

    expect(await collect(provider.createMessage(request))).toEqual([
      {
        type: "text_delta",
        text: "ok",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
  });

  it("creates a provider factory for openai-compatible provider configs", async () => {
    const provider = createOpenAICompatibleProvider(
      {
        providerId: "compatible",
        providerConfig: {
          kind: "openai",
          apiUrl: "https://api.compatible.example/v1",
        },
        modelConfig: {
          providerId: "compatible",
          modelId: "provider-model",
        },
      },
      {
        client: createMockClient([], {
          choices: [
            {
              index: 0,
              logprobs: null,
              message: {
                role: "assistant",
                content: "ok",
                refusal: null,
              },
              finish_reason: "stop",
            },
          ],
        }),
      }
    );

    expect(provider).toBeDefined();

    if (!provider) {
      throw new Error("Expected provider to be created.");
    }

    expect(await collect(provider.createMessage(request))).toEqual([
      {
        type: "text_delta",
        text: "ok",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ]);
  });
});

async function collect(
  events: AsyncIterable<ModelEvent>
): Promise<ModelEvent[]> {
  const collected: ModelEvent[] = [];

  for await (const event of events) {
    collected.push(event);
  }

  return collected;
}

function createMockClient(
  calls: unknown[],
  completion: unknown
): OpenAIChatCompletionsClient {
  return {
    chat: {
      completions: {
        async create(body) {
          await Promise.resolve();
          calls.push(body);

          return completion as Awaited<
            ReturnType<
              OpenAIChatCompletionsClient["chat"]["completions"]["create"]
            >
          >;
        },
      },
    },
  };
}
