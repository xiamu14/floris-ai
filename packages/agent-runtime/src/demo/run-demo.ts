import { fileURLToPath } from "node:url";
import { createMimoAgentConfig } from "../config/mimo-agent-config";
import { BasicContextBuilder } from "../context/context-builder";
import { AgentLoop } from "../core/agent-loop";
import { resolveProviderForRole } from "../providers/provider-resolver";
import { InMemorySessionStore } from "../session/in-memory-session-store";
import { toolRegistry } from "../tools/tool";
import { InMemoryToolOutputArtifactStore } from "../tools/tool-output-artifact-store";
import type { AgentProfile } from "../types/agent.type";
import type { DebugLogger } from "../types/log.type";
import type { ModelProvider } from "../types/provider.type";
import { createDebugLogger } from "./utils/debug-logger";
import { DebugModelProvider } from "./utils/debug-model-provider";
import { DebugSessionStore } from "./utils/debug-session-store";

const DEBUG = true;
const demoArgs = process.argv.slice(2);
const exampleName = readExampleName(demoArgs);
const freeformMessage = readFreeformMessage(demoArgs);
const allowedTools = readExampleAllowedTools(exampleName, freeformMessage);
const workspacePath = readExampleWorkspacePath(exampleName) ?? process.cwd();
const maxIterations = readExampleMaxIterations(exampleName);
const userMessage =
  freeformMessage ||
  readExampleMessage(exampleName) ||
  "Use echo_tool to echo hello, then summarize the result.";

const logger = createDebugLogger({
  debug: DEBUG,
});

logger.log("agentLoop", "start", "run demo", {
  debug: DEBUG,
  exampleName: exampleName ?? "default",
  workspacePath,
  allowedTools,
  maxIterations,
  userMessage,
});

const provider = createMimoProvider(logger);

if (provider) {
  const debugProvider = new DebugModelProvider({
    logger,
    provider,
  });
  const sessionStore = new InMemorySessionStore();
  const profile = createDemoProfile(debugProvider.id, allowedTools);

  logger.log("agentLoop", "create", "create agent loop", {
    providerId: debugProvider.id,
    profile,
  });

  const loop = new AgentLoop({
    provider: debugProvider,
    toolRegistry,
    toolOutputArtifactStore: new InMemoryToolOutputArtifactStore(),
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
    workspacePath,
    userMessage,
    options: {
      maxIterations,
    },
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
        toolCallSequence: result.events
          .filter((event) => event.type === "provider_tool_call_done")
          .map((event) => toToolCallSummary(event.payload)),
        frameworkContext: result.events
          .filter((event) => event.type === "framework_context_created")
          .map((event) => event.payload),
        toolOutputFiltering: result.events
          .filter((event) => event.type === "tool_finished")
          .map((event) => event.payload),
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

function createDemoProfile(
  providerId: string,
  allowedTools: string[]
): AgentProfile {
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
    allowedTools,
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

function toToolCallSummary(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "iteration" in payload &&
    "event" in payload &&
    typeof payload.event === "object" &&
    payload.event !== null &&
    "type" in payload.event &&
    payload.event.type === "tool_call_done" &&
    "toolCall" in payload.event &&
    typeof payload.event.toolCall === "object" &&
    payload.event.toolCall !== null &&
    "id" in payload.event.toolCall &&
    "name" in payload.event.toolCall &&
    "input" in payload.event.toolCall
  ) {
    return {
      iteration: payload.iteration,
      id: payload.event.toolCall.id,
      name: payload.event.toolCall.name,
      input: payload.event.toolCall.input,
    };
  }

  return payload;
}

function readFreeformMessage(args: string[]): string {
  const freeformArgs: string[] = [];
  let skipNext = false;

  for (const arg of args) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    if (arg === "--example") {
      skipNext = true;
      continue;
    }

    if (arg.startsWith("--")) {
      continue;
    }

    freeformArgs.push(arg);
  }

  return freeformArgs.join(" ");
}

function readExampleName(args: string[]): string | undefined {
  const index = args.indexOf("--example");

  if (index < 0) {
    return undefined;
  }

  return args.at(index + 1);
}

function readExampleMessage(
  exampleName: string | undefined
): string | undefined {
  switch (exampleName) {
    case "echo":
      return "Use echo_tool to echo hello, then summarize the result.";
    case "list_files":
      return "Use list_files with path packages/agent-runtime/src/tools, maxDepth 1, limit 30. Summarize the result.";
    case "read_file":
      return "Use read_file to read packages/agent-runtime/src/tools/echo-tool.ts with maxLines 80. Summarize the tool architecture shown there.";
    case "search_files":
      return "Use search_files to find framework_context_created under packages/agent-runtime/src with maxMatches 20. Summarize where it appears.";
    case "git_status":
      return "Use git_status with limit 80. Summarize the current workspace changes.";
    case "run_command":
      return "Use run_command to run git status --short in the workspace. Summarize the result.";
    case "http_request":
      return "Use http_request to GET http://127.0.0.1:3102 with timeoutMs 3000. Summarize the response or connection error.";
    case "analyze-case":
      return [
        "Analyze this case repository and explain what product/library it implements.",
        "Work step by step and use multiple tools instead of guessing:",
        "1. inspect git status and the repository structure;",
        "2. read the root/package metadata and README;",
        "3. inspect the core package source and at least one demo app integration;",
        "4. search for important exports, engine classes, or API entry points;",
        "5. summarize the repository purpose, main modules, runtime flow, and likely usage.",
        "Keep the final answer concise and cite file paths you inspected.",
      ].join("\n");
    default:
      return undefined;
  }
}

function readExampleWorkspacePath(exampleName: string | undefined) {
  if (exampleName === "analyze-case") {
    return fileURLToPath(new URL("./case", import.meta.url));
  }

  return undefined;
}

function readExampleMaxIterations(exampleName: string | undefined): number {
  if (exampleName === "analyze-case") {
    return 8;
  }

  return 4;
}

function readExampleAllowedTools(
  exampleName: string | undefined,
  freeformMessage: string
): string[] {
  switch (exampleName) {
    case "echo":
      return ["echo_tool"];
    case "list_files":
      return ["list_files"];
    case "read_file":
      return ["read_file"];
    case "search_files":
      return ["search_files"];
    case "git_status":
      return ["git_status"];
    case "run_command":
      return ["run_command"];
    case "http_request":
      return ["http_request"];
    case "analyze-case":
      return [
        "git_status",
        "list_files",
        "read_file",
        "search_files",
        "run_command",
      ];
    default:
      if (freeformMessage.length > 0) {
        return [
          "echo_tool",
          "list_files",
          "read_file",
          "search_files",
          "git_status",
          "run_command",
          "http_request",
        ];
      }

      return ["echo_tool"];
  }
}
