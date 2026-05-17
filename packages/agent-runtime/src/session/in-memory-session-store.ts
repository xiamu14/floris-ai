import type { AgentEvent } from "../types/runtime.type";
import type { SessionEventQuery, SessionStore } from "../types/session.type";

export class InMemorySessionStore implements SessionStore {
  private readonly events: AgentEvent[] = [];

  appendEvent(event: AgentEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  listEvents(query: SessionEventQuery): Promise<AgentEvent[]> {
    return Promise.resolve(
      this.events.filter(
        (event) =>
          event.threadId === query.threadId && event.branchId === query.branchId
      )
    );
  }

  append(event: AgentEvent): Promise<void> {
    return this.appendEvent(event);
  }

  list(threadId: string, branchId: string): Promise<AgentEvent[]> {
    return this.listEvents({ threadId, branchId });
  }
}
