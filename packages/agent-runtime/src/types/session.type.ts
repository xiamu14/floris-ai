import type { AgentEvent } from "./runtime.type";

export interface SessionStore {
  append(event: AgentEvent): Promise<void>;
  list(threadId: string, branchId: string): Promise<AgentEvent[]>;
}
