import { describe, expect, it } from "vitest";
import { InMemorySessionStore } from "../src/session/in-memory-session-store";
import type { AgentEvent } from "../src/types/runtime.type";

describe("session store", () => {
  it("lists events by thread and branch in write order", async () => {
    const store = new InMemorySessionStore();
    const first = createEvent("event-1", "thread-1", "branch-1");
    const second = createEvent("event-2", "thread-1", "branch-1");
    const otherBranch = createEvent("event-3", "thread-1", "branch-2");

    await store.appendEvent(first);
    await store.appendEvent(second);
    await store.appendEvent(otherBranch);

    await expect(
      store.listEvents({ threadId: "thread-1", branchId: "branch-1" })
    ).resolves.toEqual([first, second]);
  });
});

function createEvent(
  id: string,
  threadId: string,
  branchId: string
): AgentEvent {
  return {
    id,
    type: "user_message",
    threadId,
    branchId,
    createdAt: "2026-05-17T00:00:00.000Z",
    payload: {
      content: "hello",
    },
  };
}
