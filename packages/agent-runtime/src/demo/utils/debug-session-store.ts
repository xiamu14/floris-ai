import type { DebugSessionStoreInput } from "../../types/log.type";
import type { AgentEvent } from "../../types/runtime.type";
import type { SessionStore } from "../../types/session.type";

export class DebugSessionStore implements SessionStore {
  private readonly input: DebugSessionStoreInput;

  constructor(input: DebugSessionStoreInput) {
    this.input = input;
  }

  async append(event: AgentEvent): Promise<void> {
    this.input.logger.log("agentLoop", "event", event.type, {
      threadId: event.threadId,
      branchId: event.branchId,
      payload: event.payload,
    });

    await this.input.store.append(event);
  }

  list(threadId: string, branchId: string): Promise<AgentEvent[]> {
    return this.input.store.list(threadId, branchId);
  }
}
