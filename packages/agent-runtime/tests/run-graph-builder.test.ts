import { describe, expect, it } from "vitest";
import {
  buildRunGraph,
  validateRunGraph,
} from "../src/session/run-graph-builder";
import type { AgentEvent } from "../src/types/runtime.type";

describe("run graph builder", () => {
  it("builds a text-only run graph from session events", () => {
    const graph = buildRunGraph({
      runId: "run-1",
      events: [
        event("event-1", "user_message", {
          content: "hello",
        }),
        event("event-2", "context_built", {
          tokenEstimate: 24,
          sections: [],
        }),
        event("event-3", "model_request_started", {
          iteration: 0,
          model: {
            providerId: "test",
            modelId: "test-coder",
          },
        }),
        event("event-4", "provider_text_delta", {
          iteration: 0,
          event: {
            type: "text_delta",
            text: "hi",
          },
        }),
        event("event-5", "provider_usage", {
          iteration: 0,
          event: {
            type: "usage",
            usage: {
              inputTokens: 3,
              outputTokens: 4,
              totalTokens: 7,
            },
          },
        }),
        event("event-6", "provider_done", {
          iteration: 0,
          event: {
            type: "done",
            stopReason: "end_turn",
          },
        }),
        event("event-7", "stop", {
          stopReason: "assistant_done",
        }),
      ],
    });

    expect(graph).toMatchObject({
      schemaVersion: 1,
      runId: "run-1",
      threadId: "thread",
      branchId: "branch",
      stopReason: "assistant_done",
      metrics: {
        totalInputTokens: 3,
        totalOutputTokens: 4,
        totalTokens: 7,
        modelRequestCount: 1,
        contextBuildCount: 1,
        toolCallCount: 0,
      },
    });
    expect(graph.nodes.map((node) => node.kind)).toEqual([
      "user_message",
      "context_build",
      "model_request",
      "provider_event",
      "provider_event",
      "provider_event",
      "stop",
    ]);
    expect(graph.diagnostics).toEqual([]);
  });

  it("links tool call, permission, and tool result nodes", () => {
    const graph = buildRunGraph({
      events: [
        event("event-1", "user_message"),
        event("event-2", "context_built", {
          tokenEstimate: 40,
        }),
        event("event-3", "model_request_started", {
          iteration: 0,
        }),
        event("event-4", "provider_tool_call_done", {
          iteration: 0,
          event: {
            type: "tool_call_done",
            toolCall: {
              id: "tool-call-1",
              name: "echo_tool",
              input: { text: "hello" },
            },
          },
        }),
        event("event-5", "provider_done", {
          iteration: 0,
          event: {
            type: "done",
            stopReason: "tool_use",
          },
        }),
        event("event-6", "tool_started", {
          toolCall: {
            id: "tool-call-1",
            name: "echo_tool",
            input: { text: "hello" },
          },
        }),
        event("event-7", "permission_checked", {
          toolCallId: "tool-call-1",
          decision: {
            decision: "allow",
            source: "default_noop",
            reason: "allowed",
            toolName: "echo_tool",
            createdAt: "2026-05-17T00:00:07.000Z",
          },
        }),
        event("event-8", "tool_finished", {
          toolCallId: "tool-call-1",
          result: {
            ok: true,
            summary: "Echoed hello",
          },
        }),
        event("event-9", "stop", {
          stopReason: "assistant_done",
        }),
      ],
    });

    expect(graph.nodes.map((node) => node.kind)).toContain("permission");
    expect(graph.nodes.map((node) => node.kind)).toContain("tool_call");
    expect(graph.nodes.map((node) => node.kind)).toContain("tool_result");
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "event-6",
        target: "event-7",
        kind: "caused_by",
      })
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "event-6",
        target: "event-8",
        kind: "caused_by",
      })
    );
    expect(graph.diagnostics).toEqual([]);
  });

  it("diagnoses missing stop events", () => {
    const graph = buildRunGraph({
      events: [
        event("event-1", "user_message"),
        event("event-2", "context_built"),
      ],
    });

    expect(graph.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing_stop",
        severity: "error",
      })
    );
  });

  it("diagnoses tool calls without permission events", () => {
    const graph = buildRunGraph({
      events: [
        event("event-1", "user_message"),
        event("event-2", "tool_started", {
          toolCall: {
            id: "tool-call-1",
            name: "echo_tool",
          },
        }),
        event("event-3", "tool_finished", {
          toolCallId: "tool-call-1",
          result: {
            ok: true,
            summary: "done",
          },
        }),
        event("event-4", "stop", {
          stopReason: "assistant_done",
        }),
      ],
    });

    expect(graph.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "tool_without_permission",
        nodeId: "event-2",
      })
    );
  });

  it("diagnoses provider max tokens without provider_max_tokens stop", () => {
    const graph = buildRunGraph({
      events: [
        event("event-1", "user_message"),
        event("event-2", "model_request_started", {
          iteration: 0,
        }),
        event("event-3", "provider_done", {
          iteration: 0,
          event: {
            type: "done",
            stopReason: "max_tokens",
          },
        }),
        event("event-4", "stop", {
          stopReason: "assistant_done",
        }),
      ],
    });

    expect(graph.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "provider_max_tokens_without_explicit_stop",
        nodeId: "event-3",
      })
    );
  });

  it("allows provider max tokens when the run stop reason matches", () => {
    const graph = buildRunGraph({
      events: [
        event("event-1", "user_message"),
        event("event-2", "model_request_started", {
          iteration: 0,
        }),
        event("event-3", "provider_done", {
          iteration: 0,
          event: {
            type: "done",
            stopReason: "max_tokens",
          },
        }),
        event("event-4", "stop", {
          stopReason: "provider_max_tokens",
        }),
      ],
    });

    expect(
      graph.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "provider_max_tokens_without_explicit_stop"
      )
    ).toBe(false);
  });

  it("can validate a graph after diagnostics are cleared", () => {
    const graph = buildRunGraph({
      events: [
        event("event-1", "user_message"),
        event("event-2", "stop", {
          stopReason: "assistant_done",
        }),
      ],
    });

    expect(validateRunGraph({ ...graph, diagnostics: [] })).toEqual([]);
  });
});

function event(id: string, type: string, payload?: unknown): AgentEvent {
  return {
    id,
    type,
    threadId: "thread",
    branchId: "branch",
    createdAt: `2026-05-17T00:00:${id.replace("event-", "").padStart(2, "0")}.000Z`,
    ...(payload === undefined ? {} : { payload }),
  };
}
