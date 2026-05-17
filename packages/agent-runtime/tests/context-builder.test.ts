import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BasicContextBuilder } from "../src/context/context-builder";
import type { AgentProfile } from "../src/types/agent.type";

describe("context builder", () => {
  it("builds system sections and keeps recent messages", async () => {
    const builder = new BasicContextBuilder();
    const result = await builder.build({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
    });

    expect(result.system[0]).toContain("System prompt");
    expect(result.messages).toEqual([
      {
        role: "user",
        content: "hello",
      },
    ]);
    expect(result.sections.map((section) => section.kind)).toEqual([
      "system",
      "recent_messages",
    ]);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it("loads workspace AGENTS.md as project instructions", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "floris-context-"));
    await writeFile(
      path.join(workspacePath, "AGENTS.md"),
      "Use concise project instructions.\n",
      "utf8"
    );
    const builder = new BasicContextBuilder();
    const result = await builder.build({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      workspacePath,
      messages: [
        {
          role: "user",
          content: "hello",
        },
      ],
    });

    expect(
      result.sections.find((section) => section.kind === "project_instructions")
    ).toMatchObject({
      title: "Project instructions",
      content: expect.stringContaining("Use concise project instructions."),
      source: {
        type: "workspace_file",
        ref: "AGENTS.md",
      },
    });
  });

  it("records skipped project instructions when AGENTS.md is missing", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "floris-context-"));
    const builder = new BasicContextBuilder();
    const result = await builder.build({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      workspacePath,
      messages: [],
    });

    expect(result.skippedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "project_instructions",
          source: {
            type: "workspace_file",
            ref: "AGENTS.md",
          },
        }),
      ])
    );
  });

  it("adds memory entries as a separate section", async () => {
    const builder = new BasicContextBuilder();
    const result = await builder.build({
      profile: createProfile(),
      threadId: "thread",
      branchId: "branch",
      messages: [],
      memoryEntries: [
        {
          id: "memory-1",
          scope: "project",
          type: "coding_rule",
          content: "Prefer ArkType for runtime contracts.",
          enabled: true,
          createdAt: "2026-05-17T00:00:00.000Z",
          updatedAt: "2026-05-17T00:00:00.000Z",
          source: "user",
          projectId: "project",
        },
      ],
    });

    expect(
      result.sections.find((section) => section.kind === "memory")
    ).toMatchObject({
      content: expect.stringContaining("Prefer ArkType"),
      source: {
        type: "memory",
        ref: "memory-1",
      },
    });
  });
});

function createProfile(): AgentProfile {
  return {
    id: "coder",
    displayName: "Coder",
    role: "coder",
    systemPrompt: {
      promptId: "agent.coder.system",
    },
    model: {
      providerId: "test",
      modelId: "test-coder",
    },
    allowedTools: ["echo_tool"],
    contextPolicy: {
      maxInputTokens: 4000,
      includeProjectInstructions: true,
      includeRecentMessages: true,
      includeMemory: true,
      includeToolDefinitions: true,
    },
    stopPolicy: {
      maxIterations: 4,
      stopOnProviderError: true,
      stopOnToolError: true,
    },
    writeAccess: "workspace",
  };
}
