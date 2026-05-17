import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { BasicContextBuilder } from "../context/context-builder";
import { AgentLoop } from "../core/agent-loop";
import { InMemoryMemoryStore } from "../memory/memory-store";
import { NoopPermissionGate } from "../permissions/permission-gate";
import { InMemorySessionStore } from "../session/in-memory-session-store";
import { echoTool } from "../tools/echo-tool";
import { InMemoryToolOutputArtifactStore } from "../tools/tool-output-artifact-store";
import { InMemoryToolRegistry } from "../tools/tool-registry";
import { MlflowTraceRecorder } from "../trace/mlflow-trace-recorder";
import type { AgentProfile } from "../types/agent.type";
import type {
  ModelEvent,
  ModelProvider,
  ModelRequest,
} from "../types/provider.type";

class ScriptedDemoProvider implements ModelProvider {
  readonly id = "scripted";
  readonly requests: ModelRequest[] = [];
  private cursor = 0;
  private readonly script: ModelEvent[];

  constructor(script: ModelEvent[]) {
    this.script = script;
  }

  async *createMessage(request: ModelRequest): AsyncIterable<ModelEvent> {
    await Promise.resolve();
    this.requests.push(request);

    while (this.cursor < this.script.length) {
      const event = this.script[this.cursor];
      this.cursor += 1;

      if (!event) {
        return;
      }

      yield event;

      if (event.type === "done" || event.type === "error") {
        return;
      }
    }
  }
}

const workspacePath = await mkdtemp(path.join(tmpdir(), "floris-14-demo-"));
await writeFile(
  path.join(workspacePath, "AGENTS.md"),
  "Demo workspace rule: keep answers concise.\n",
  "utf8"
);

const memoryStore = new InMemoryMemoryStore();
await memoryStore.add({
  scope: "thread",
  type: "summary",
  content: "Remember the local lesson 1.4 trace demo.",
  source: "user",
  threadId: "lesson-14-demo-thread",
});

const sessionStore = new InMemorySessionStore();
const provider = new ScriptedDemoProvider([
  {
    type: "tool_call_done",
    toolCall: {
      id: "lesson-14-tool-call",
      name: "echo_tool",
      input: {
        text: "hello from lesson 1.4",
      },
    },
  },
  {
    type: "done",
    stopReason: "tool_use",
  },
  {
    type: "text_delta",
    text: "lesson 1.4 local demo complete",
  },
  {
    type: "done",
    stopReason: "end_turn",
  },
]);
const loop = new AgentLoop({
  provider,
  toolRegistry: new InMemoryToolRegistry([echoTool]),
  toolOutputArtifactStore: new InMemoryToolOutputArtifactStore(),
  contextBuilder: new BasicContextBuilder(),
  memoryStore,
  sessionStore,
  permissionGate: new NoopPermissionGate(),
  traceRecorder: new MlflowTraceRecorder({
    trackingUri: process.env.MLFLOW_TRACKING_URI ?? "http://127.0.0.1:5001",
    experimentId: process.env.MLFLOW_EXPERIMENT_ID ?? "0",
    sourceName: "packages/agent-runtime/src/demo/run-lesson14-demo.ts",
  }),
});

const result = await loop.runTurn({
  profile: createProfile(),
  threadId: "lesson-14-demo-thread",
  branchId: "main",
  workspacePath,
  userMessage: "Run the local lesson 1.4 trace demo.",
});
const sessionEvents = await sessionStore.listEvents({
  threadId: "lesson-14-demo-thread",
  branchId: "main",
});

console.log(
  JSON.stringify(
    {
      stopReason: result.stopReason,
      finalMessage: result.finalMessage,
      eventTypes: result.events.map((event) => event.type),
      sessionEventCount: sessionEvents.length,
      requestSystemSections: provider.requests.map(
        (request) => request.system.length
      ),
      latestSystemPreview: provider.requests.at(-1)?.system.join("\n\n"),
    },
    null,
    2
  )
);

function createProfile(): AgentProfile {
  return {
    id: "coder",
    displayName: "Coder",
    role: "coder",
    systemPrompt: {
      promptId: "agent.coder.system",
    },
    model: {
      providerId: "scripted",
      modelId: "scripted-demo",
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
