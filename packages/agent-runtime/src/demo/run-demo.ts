import { createMimoAgentConfig } from "../config/mimo-agent-config";
import { BasicContextBuilder } from "../context/context-builder";
import { AgentLoop } from "../core/agent-loop";
import { TransportBackedModelProvider } from "../providers/model-provider-proxy";
import { createOpenAICompatibleProviderFromEnv } from "../providers/openai-compatible-provider-factory";
import { resolveProviderForRole } from "../providers/provider-resolver";
import { MockProviderTransport } from "../providers/provider-transport";
import { InMemorySessionStore } from "../session/in-memory-session-store";
import { echoTool } from "../tools/echo-tool";
import { InMemoryToolRegistry } from "../tools/tool-registry";
import type { AgentProfile } from "../types/agent.type";
import type { ModelProvider } from "../types/provider.type";

const useMock = process.argv.includes("--mock");
const userMessage =
  process.argv
    .filter((arg) => !arg.startsWith("--"))
    .slice(2)
    .join(" ") || "Use echo_tool to echo hello, then summarize the result.";

const provider = useMock ? createMockProvider() : createMimoProvider();

if (provider) {
  const loop = new AgentLoop({
    provider,
    toolRegistry: new InMemoryToolRegistry([echoTool]),
    contextBuilder: new BasicContextBuilder(),
    sessionStore: new InMemorySessionStore(),
  });
  const result = await loop.runTurn({
    profile: createDemoProfile(provider.id),
    threadId: "demo-thread",
    branchId: "main",
    userMessage,
  });

  console.log(
    JSON.stringify(
      {
        stopReason: result.stopReason,
        finalMessage: result.finalMessage,
        usage: result.usage,
        eventTypes: result.events.map((event) => event.type),
        providerErrors: result.events
          .filter((event) => event.type === "provider_error")
          .map((event) => event.payload),
      },
      null,
      2
    )
  );
} else {
  console.error(
    "MIMO provider is not available. Set MIMO_API_KEY or run: bun run demo -- --mock"
  );
  process.exitCode = 1;
}

function createMimoProvider(): ModelProvider | undefined {
  const config = createMimoAgentConfig();
  const resolved = resolveProviderForRole(config, "coder", (input) =>
    createOpenAICompatibleProviderFromEnv(input)
  );

  if (!resolved.ok) {
    console.error(resolved.error)
    console.error(resolved.issues)
    return undefined;
  }

  return resolved.provider;
}

function createMockProvider(): ModelProvider {
  return new TransportBackedModelProvider(
    {
      providerId: "mock",
      kind: "custom",
      apiUrl: "mock://provider",
      modelId: "mock-coder",
    },
    new MockProviderTransport([
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
      {
        type: "text_delta",
        text: "tool returned hello",
      },
      {
        type: "done",
        stopReason: "end_turn",
      },
    ])
  );
}

function createDemoProfile(providerId: string): AgentProfile {
  return {
    id: "coder",
    displayName: "Coder",
    role: "coder",
    systemPrompt: {
      promptId: "agent.coder.system",
    },
    model: {
      providerId,
      modelId: providerId === "mimo" ? "mimo-v2.5-pro" : "mock-coder",
    },
    allowedTools: ["echo_tool"],
    contextPolicy: {
      maxInputTokens: 4000,
      includeProjectInstructions: true,
      includeRecentMessages: true,
      includeMemory: true,
      includeToolDefinitions: true,
    },
    stopPolicy: {
      maxIterations: 4,
      stopOnProviderError: true,
      stopOnToolError: true,
    },
    writeAccess: "workspace",
  };
}
