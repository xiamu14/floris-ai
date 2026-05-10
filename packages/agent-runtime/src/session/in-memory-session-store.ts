import type { AgentEvent } from "../types/runtime.type";
import type { SessionStore } from "../types/session.type";

export class InMemorySessionStore implements SessionStore {
  private readonly events: AgentEvent[] = [];

  append(event: AgentEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  list(threadId: string, branchId: string): Promise<AgentEvent[]> {
    return Promise.resolve(
      this.events.filter(
        (event) => event.threadId === threadId && event.branchId === branchId
      )
    );
  }
}
