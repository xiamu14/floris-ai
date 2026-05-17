import type {
  RuntimeRpcCommandEnvelope,
  RuntimeRpcCommandFailedEnvelope,
  RuntimeRpcOutputEnvelope,
  RuntimeRpcStreamEventEnvelope,
} from "../types/rpc.type";
import type { AgentStreamEvent } from "../types/stream.type";

export function isRuntimeRpcCommand(
  value: unknown
): value is RuntimeRpcCommandEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "type" in value &&
    typeof value.id === "string" &&
    (value.type === "run.start" || value.type === "run.abort")
  );
}

export function createCommandAccepted(input: {
  commandId: string;
  runId?: string;
}): RuntimeRpcOutputEnvelope {
  return {
    id: crypto.randomUUID(),
    type: "command.accepted",
    commandId: input.commandId,
    ...(input.runId ? { runId: input.runId } : {}),
    createdAt: new Date().toISOString(),
  };
}

export function createCommandFailed(input: {
  commandId?: string;
  code: string;
  message: string;
}): RuntimeRpcCommandFailedEnvelope {
  return {
    id: crypto.randomUUID(),
    type: "command.failed",
    ...(input.commandId ? { commandId: input.commandId } : {}),
    createdAt: new Date().toISOString(),
    error: {
      code: input.code,
      message: input.message,
    },
  };
}

export function createStreamEventEnvelope(
  event: AgentStreamEvent
): RuntimeRpcStreamEventEnvelope {
  return {
    id: crypto.randomUUID(),
    type: "stream.event",
    runId: event.runId,
    createdAt: new Date().toISOString(),
    event,
  };
}
