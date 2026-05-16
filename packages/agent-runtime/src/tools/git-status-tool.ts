import { type as arkType } from "arktype";
import type { Tool } from "../types/tool.type";
import {
  createToolError,
  createToolSuccess,
  runWorkspaceCommand,
  saveRawArtifact,
} from "./workspace-tool-utils";

const GitStatusInput = arkType({
  "limit?": "number",
});
const LINE_SPLIT_PATTERN = /\r?\n/;

export const gitStatusTool: Tool = {
  name: "git_status",
  description:
    "Returns a compact git status summary using porcelain output from the workspace.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number" },
    },
    additionalProperties: false,
  },
  async execute(input, context) {
    const parsed = GitStatusInput(input);

    if (parsed instanceof arkType.errors) {
      return createToolError({
        summary: "git_status input validation failed.",
        message: String(parsed),
        filterId: "git-status-domain-filter",
      });
    }

    const result = await runWorkspaceCommand({
      command: "git",
      args: ["status", "--porcelain=v1", "-b"],
      cwd: context.run.workspacePath,
      timeoutMs: 5000,
    });
    const rawOutput = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const artifacts = await saveRawArtifact(
      context,
      "git_status",
      rawOutput,
      "text/plain"
    );

    if (result.exitCode !== 0) {
      return createToolError({
        summary: "git_status failed.",
        message: rawOutput || `git status exited with ${result.exitCode}.`,
        filterId: "git-status-domain-filter",
      });
    }

    const lines = result.stdout.split(LINE_SPLIT_PATTERN).filter(Boolean);
    const branch = lines.find((line) => line.startsWith("##")) ?? "## unknown";
    const changed = lines.filter((line) => !line.startsWith("##"));
    const limit = Math.min(Math.floor(parsed.limit ?? 80), 300);
    const contextContent = [
      branch,
      `Changed files: ${changed.length}`,
      ...changed.slice(0, limit),
      changed.length > limit
        ? `... omitted ${changed.length - limit} changed file(s)`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    return createToolSuccess({
      summary: `Git status: ${changed.length} changed file(s).`,
      display: contextContent,
      contextContent,
      rawContent: rawOutput,
      artifacts,
      filterId: "git-status-domain-filter",
      strategy: "stats_extraction",
      data: {
        branch,
        changedCount: changed.length,
        changedFiles: changed.slice(0, limit),
      },
    });
  },
};
