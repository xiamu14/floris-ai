import { describe, expect, it } from "vitest";
import { InMemoryMemoryStore } from "../src/memory/memory-store";

describe("memory store", () => {
  it("adds, queries, and disables memory entries", async () => {
    const store = new InMemoryMemoryStore();
    const entry = await store.add({
      scope: "project",
      type: "coding_rule",
      content: "Use ArkType for internal runtime contracts.",
      source: "user",
      projectId: "project-1",
    });

    await store.add({
      scope: "thread",
      type: "summary",
      content: "Different thread summary.",
      source: "compaction",
      threadId: "thread-2",
    });

    await expect(
      store.listRelevant({
        scopes: ["project"],
        types: ["coding_rule"],
        projectId: "project-1",
      })
    ).resolves.toEqual([entry]);
    await expect(
      store.listRelevant({
        scopes: ["thread"],
        threadId: "thread-1",
      })
    ).resolves.toEqual([]);

    await store.disable(entry.id);

    await expect(
      store.listRelevant({
        scopes: ["project"],
        projectId: "project-1",
      })
    ).resolves.toEqual([]);
  });
});
