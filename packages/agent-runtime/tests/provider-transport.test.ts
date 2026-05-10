import { describe, expect, it } from "vitest";
import { TransportBackedModelProvider } from "../src/providers/model-provider-proxy";
import { MockProviderTransport } from "../src/providers/provider-transport";
import type { ModelEvent, ModelRequest } from "../src/types/provider.type";

describe("provider transport", () => {
  const request: ModelRequest = {
    model: {
      providerId: "mock",
      modelId: "mock-coder",
    },
    system: ["You are a coding agent."],
    messages: [
      {
        role: "user",
        content: "echo hello",
      },
    ],
    tools: [],
  };

  it("replays scripted events through the ModelProvider path", async () => {
    const script: ModelEvent[] = [
      {
        type: "tool_call_done",
        toolCall: {
          id: "tool-call-1",
          name: "echo_tool",
          input: { text: "hello" },
        },
      },
      {
        type: "done",
        stopReason: "tool_use",
      },
    ];

    const provider = new TransportBackedModelProvider(
      {
        providerId: "mock",
        kind: "custom",
        apiUrl: "mock://provider",
        modelId: "mock-coder",
      },
      new MockProviderTransport(script)
    );

    const events: ModelEvent[] = [];

    for await (const event of provider.createMessage(request)) {
      events.push(event);
    }

    expect(events).toEqual(script);
  });

  it("stops replay when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const provider = new TransportBackedModelProvider(
      {
        providerId: "mock",
        kind: "custom",
        apiUrl: "mock://provider",
        modelId: "mock-coder",
      },
      new MockProviderTransport([
        {
          type: "text_delta",
          text: "should not emit",
        },
      ])
    );

    const events: ModelEvent[] = [];

    for await (const event of provider.createMessage(
      request,
      controller.signal
    )) {
      events.push(event);
    }

    expect(events).toEqual([]);
  });
});
