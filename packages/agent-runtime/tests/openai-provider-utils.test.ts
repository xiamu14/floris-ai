import { describe, expect, it } from "vitest";
import { toModelEvents } from "../src/providers/utils/openai-event-mapper";
import { toOpenAIChatCompletionRequest } from "../src/providers/utils/openai-request-mapper";
import type { ModelEvent, ModelRequest } from "../src/types/provider.type";

describe("OpenAI provider utils", () => {
  it("maps internal model requests to OpenAI chat completion params", () => {
    const request: ModelRequest = {
      model: {
        providerId: "compatible",
        modelId: "request-model",
      },
      system: ["system prompt"],
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
      tools: [],
      parameters: {
        temperature: 0.2,
      },
    };

    expect(
      toOpenAIChatCompletionRequest(request, {
        modelId: "configured-model",
        modelParameters: {
          maxCompletionTokens: 2048,
          topP: 0.9,
        },
      })
    ).toEqual({
      model: "configured-model",
      messages: [
        {
          role: "system",
          content: "system prompt",
        },
        {
          role: "user",
          content: "hello",
        },
      ],
      stream: false,
      max_completion_tokens: 2048,
      top_p: 0.9,
      temperature: 0.2,
    });
  });

  it("maps OpenAI completion output to internal model events", async () => {
    const events = await collect(
      toModelEvents({
        id: "completion_1",
        created: 0,
        model: "provider-model",
        object: "chat.completion",
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
      })
    );

    expect(events).toEqual([
      {
        type: "text_delta",
        text: "hello",
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
