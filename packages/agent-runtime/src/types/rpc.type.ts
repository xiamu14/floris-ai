import type { AgentStreamEvent } from "./stream.type";

export type RuntimeRpcCommandType = "run.start" | "run.abort";

export interface RuntimeRpcCommandEnvelope {
  id: string;
  type: RuntimeRpcCommandType;
  createdAt: string;
  payload?: RuntimeRpcCommandPayload;
}

export type RuntimeRpcCommandPayload =
  | RunStartCommandPayload
  | RunAbortCommandPayload;

export interface RunStartCommandPayload {
  runId?: string;
  threadId?: string;
  branchId?: string;
  workspacePath?: string;
  message: string;
  providerMode?: "scripted" | "mimo";
}

export interface RunAbortCommandPayload {
  runId: string;
}

export type RuntimeRpcOutputEnvelope =
  | RuntimeRpcCommandAcceptedEnvelope
  | RuntimeRpcCommandFailedEnvelope
  | RuntimeRpcStreamEventEnvelope;

export interface RuntimeRpcCommandAcceptedEnvelope {
  id: string;
  type: "command.accepted";
  commandId: string;
  runId?: string;
  createdAt: string;
}

export interface RuntimeRpcCommandFailedEnvelope {
  id: string;
  type: "command.failed";
  commandId?: string;
  createdAt: string;
  error: {
    code: string;
    message: string;
  };
}

export interface RuntimeRpcStreamEventEnvelope {
  id: string;
  type: "stream.event";
  runId: string;
  createdAt: string;
  event: AgentStreamEvent;
}
