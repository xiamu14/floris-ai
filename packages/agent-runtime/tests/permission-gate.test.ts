import { describe, expect, it } from "vitest";
import { NoopPermissionGate } from "../src/permissions/permission-gate";

describe("permission gate", () => {
  it("returns a structured default allow decision", async () => {
    const gate = new NoopPermissionGate();

    await expect(
      gate.check({
        toolCallId: "tool-call-1",
        agentId: "coder",
        threadId: "thread",
        branchId: "branch",
        toolName: "echo_tool",
        input: { text: "hello" },
        cwd: "/workspace",
        riskTags: ["unknown"],
      })
    ).resolves.toMatchObject({
      decision: "allow",
      source: "default_noop",
      toolName: "echo_tool",
      reason: "Default workspace policy allows this tool call.",
      createdAt: expect.any(String),
    });
  });
});
