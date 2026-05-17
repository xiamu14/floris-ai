import type { AgentEvent } from "./runtime.type";

export interface SessionStore {
  appendEvent(event: AgentEvent): Promise<void>;
  listEvents(query: SessionEventQuery): Promise<AgentEvent[]>;
  append(event: AgentEvent): Promise<void>;
  list(threadId: string, branchId: string): Promise<AgentEvent[]>;
}

export interface SessionEventQuery {
  threadId: string;
  branchId: string;
}
