import { createMimoAgentConfig } from "../config/mimo-agent-config";
import { BasicContextBuilder } from "../context/context-builder";
import { AgentLoop } from "../core/agent-loop";
import { resolveProviderForRole } from "../providers/provider-resolver";
import { InMemorySessionStore } from "../session/in-memory-session-store";
import { echoTool } from "../tools/echo-tool";
import { InMemoryToolRegistry } from "../tools/tool-registry";
import type { AgentProfile } from "../types/agent.type";
import type { DebugLogger } from "../types/log.type";
import type { ModelProvider } from "../types/provider.type";
import { createDebugLogger } from "./utils/debug-logger";
import { DebugModelProvider } from "./utils/debug-model-provider";
import { DebugSessionStore } from "./utils/debug-session-store";

const DEBUG = true;
const userMessage =
  process.argv
    .filter((arg) => !arg.startsWith("--"))
    .slice(2)
    .join(" ") || "Use echo_tool to echo hello, then summarize the result.";

const logger = createDebugLogger({
  debug: DEBUG,
});

logger.log("agentLoop", "start", "run demo", {
  debug: DEBUG,
  userMessage,
});

const provider = createMimoProvider(logger);

if (provider) {
  const debugProvider = new DebugModelProvider({
    logger,
    provider,
  });
  const sessionStore = new InMemorySessionStore();
  const profile = createDemoProfile(debugProvider.id);

  logger.log("agentLoop", "create", "create agent loop", {
    providerId: debugProvider.id,
    profile,
  });

  const loop = new AgentLoop({
    provider: debugProvider,
    toolRegistry: new InMemoryToolRegistry([echoTool]),
    contextBuilder: new BasicContextBuilder(),
    sessionStore: new DebugSessionStore({
      logger,
      store: sessionStore,
    }),
  });

  const result = await loop.runTurn({
    profile,
    threadId: "demo-thread",
    branchId: "main",
    userMessage,
  });

  logger.log("agentLoop", "finish", "agent loop finished", {
    stopReason: result.stopReason,
    finalMessage: result.finalMessage,
    usage: result.usage,
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
  console.error("MIMO provider is not available. Set MIMO_API_KEY.");
  process.exitCode = 1;
}

function createMimoProvider(logger: DebugLogger): ModelProvider | undefined {
  logger.log("config", "read", "read MIMO agent config");
  const config = createMimoAgentConfig();

  logger.log("provider", "resolve", "resolve provider for role", {
    requestedRole: "coder",
    providerType: "openai-compatible",
    providers: Object.keys(config.providers),
    models: Object.keys(config.models),
  });

  const resolved = resolveProviderForRole(config, "coder", {
    providerType: "openai-compatible",
  });

  if (!resolved.ok) {
    logger.log("provider", "error", "provider resolve failed", {
      error: resolved.error,
      issues: resolved.issues,
    });
    console.error(resolved.error);
    console.error(resolved.issues);
    return undefined;
  }

  logger.log("provider", "create", "provider resolved", {
    role: resolved.role,
    providerId: resolved.provider.id,
    model: resolved.model,
    issues: resolved.issues,
  });

  return resolved.provider;
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
      modelId: "mimo-v2.5-pro",
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
