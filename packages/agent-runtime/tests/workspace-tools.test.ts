import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gitStatusTool } from "../src/tools/git-status-tool";
import { httpRequestTool } from "../src/tools/http-request-tool";
import { listFilesTool } from "../src/tools/list-files-tool";
import { readFileTool } from "../src/tools/read-file-tool";
import { runCommandTool } from "../src/tools/run-command-tool";
import { searchFilesTool } from "../src/tools/search-files-tool";
import { InMemoryToolOutputArtifactStore } from "../src/tools/tool-output-artifact-store";
import { defaultToolResultPolicy } from "../src/tools/tool-result-policy";
import type { ToolExecutionContext } from "../src/types/tool.type";

describe("workspace tools", () => {
  it("lists, reads, and searches files with optimized output", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "floris-tools-"));
    const context = createToolContext(workspacePath);

    await writeFile(path.join(workspacePath, "alpha.txt"), "hello\nworld\n");
    await writeFile(path.join(workspacePath, "beta.txt"), "hello beta\n");

    const listResult = await listFilesTool.execute(
      { path: ".", maxDepth: 1, limit: 10 },
      context
    );
    const readResult = await readFileTool.execute(
      { path: "alpha.txt", maxLines: 1 },
      context
    );
    const searchResult = await searchFilesTool.execute(
      { query: "hello", maxMatches: 5 },
      context
    );

    expect(listResult).toMatchObject({
      ok: true,
      metrics: { filterId: "list-files-domain-filter" },
    });
    expect(readResult).toMatchObject({
      ok: true,
      context: { content: expect.stringContaining("hello") },
      metrics: { filterId: "read-file-domain-filter" },
    });
    expect(searchResult).toMatchObject({
      ok: true,
      summary: "Found matches in 2 file(s).",
      metrics: { filterId: "search-files-domain-filter" },
    });
  });

  it("keeps read_file source excerpts when context budget is exceeded", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "floris-tools-"));
    const context = createToolContext(workspacePath);
    const source = Array.from(
      { length: 80 },
      (_, index) => `export const value${index} = ${index};`
    ).join("\n");

    await writeFile(path.join(workspacePath, "source.ts"), source);

    const rawResult = await readFileTool.execute(
      { path: "source.ts", maxLines: 80 },
      context
    );
    const policyResult = defaultToolResultPolicy.apply({
      result: rawResult,
      maxContextTokens: 80,
    });

    expect(policyResult.result).toMatchObject({
      ok: true,
      context: {
        policy: "include",
        content: expect.stringContaining("export const value0"),
      },
      metrics: {
        truncated: true,
      },
      omitted: [
        {
          reason: "context_budget_exceeded",
        },
      ],
    });
    expect(policyResult.result.context.content).not.toBe("Read source.ts.");
  });

  it("blocks command paths outside the workspace and risky command args", async () => {
    const workspacePath = await mkdtemp(path.join(tmpdir(), "floris-tools-"));
    const context = createToolContext(workspacePath);

    const outsideResult = await readFileTool.execute({ path: "../x" }, context);
    const blockedResult = await runCommandTool.execute(
      { command: "git", args: ["reset", "--hard"] },
      context
    );

    expect(outsideResult).toMatchObject({
      ok: false,
      summary: "read_file failed.",
    });
    expect(blockedResult).toMatchObject({
      ok: false,
      summary: "run_command blocked.",
    });
  });

  it("summarizes git status and http responses", async () => {
    const workspacePath = process.cwd();
    const context = createToolContext(workspacePath);
    const gitResult = await gitStatusTool.execute({ limit: 3 }, context);
    const httpResult = await httpRequestTool.execute(
      {
        url: "data:application/json,%7B%22ok%22%3Atrue%2C%22name%22%3A%22floris%22%7D",
        timeoutMs: 1000,
      },
      context
    );

    expect(gitResult).toMatchObject({
      ok: true,
      metrics: { filterId: "git-status-domain-filter" },
    });
    expect(httpResult).toMatchObject({
      ok: true,
      summary: "HTTP 200 OK.",
      metrics: { filterId: "http-request-domain-filter" },
      context: { content: expect.stringContaining('"ok":true') },
    });
  });
});

function createToolContext(workspacePath: string): ToolExecutionContext {
  return {
    run: {
      threadId: "thread",
      branchId: "branch",
      agentId: "coder",
      workspacePath,
    },
    artifactStore: new InMemoryToolOutputArtifactStore(),
    resultPolicy: defaultToolResultPolicy,
  };
}
