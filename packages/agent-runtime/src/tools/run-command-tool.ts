import { type as arkType } from "arktype";
import type { Tool } from "../types/tool.type";
import {
  createToolError,
  createToolSuccess,
  resolveWorkspacePath,
  runWorkspaceCommand,
  saveRawArtifact,
  truncateText,
} from "./workspace-tool-utils";

const RunCommandInput = arkType({
  command: "string",
  "args?": "string[]",
  "cwd?": "string",
  "timeoutMs?": "number",
});

const ALLOWED_COMMANDS = new Set([
  "pwd",
  "ls",
  "git",
  "rg",
  "bun",
  "npm",
  "node",
  "tsc",
]);

export const runCommandTool: Tool = {
  name: "run_command",
  description:
    "Runs an allowed command in the workspace and returns a filtered stdout/stderr summary.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string" },
      args: { type: "array", items: { type: "string" } },
      cwd: { type: "string" },
      timeoutMs: { type: "number" },
    },
    required: ["command"],
    additionalProperties: false,
  },
  async execute(input, context) {
    const parsed = RunCommandInput(input);

    if (parsed instanceof arkType.errors) {
      return createToolError({
        summary: "run_command input validation failed.",
        message: String(parsed),
        filterId: "run-command-domain-filter",
      });
    }

    if (!ALLOWED_COMMANDS.has(parsed.command)) {
      return createToolError({
        summary: "run_command blocked.",
        message: `Command is not in the built-in allowlist: ${parsed.command}`,
        filterId: "run-command-domain-filter",
      });
    }

    if (hasBlockedArgs(parsed.command, parsed.args ?? [])) {
      return createToolError({
        summary: "run_command blocked.",
        message: `Command arguments are blocked by the built-in policy: ${[
          parsed.command,
          ...(parsed.args ?? []),
        ].join(" ")}`,
        filterId: "run-command-domain-filter",
      });
    }

    const cwd = resolveWorkspacePath(
      context.run.workspacePath,
      parsed.cwd ?? "."
    );
    const result = await runWorkspaceCommand({
      command: parsed.command,
      args: parsed.args ?? [],
      cwd,
      timeoutMs: Math.min(parsed.timeoutMs ?? 10_000, 60_000),
    });
    const rawOutput = [
      `$ ${[parsed.command, ...(parsed.args ?? [])].join(" ")}`,
      `exitCode=${result.exitCode}`,
      result.stdout ? `stdout:\n${result.stdout}` : "",
      result.stderr ? `stderr:\n${result.stderr}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const contextContent = truncateText(rawOutput, 12_000);
    const artifacts = await saveRawArtifact(
      context,
      "run_command",
      rawOutput,
      "text/plain"
    );

    return createToolSuccess({
      summary: `Command exited with ${result.exitCode}.`,
      display: contextContent,
      contextContent,
      rawContent: rawOutput,
      artifacts,
      filterId: "run-command-domain-filter",
      strategy: result.exitCode === 0 ? "tail_head" : "failure_focus",
      data: {
        command: parsed.command,
        args: parsed.args ?? [],
        exitCode: result.exitCode,
        timedOut: result.timedOut,
      },
    });
  },
};

function hasBlockedArgs(command: string, args: string[]): boolean {
  if (command === "git") {
    return args.some((arg) =>
      [
        "push",
        "reset",
        "checkout",
        "clean",
        "commit",
        "rebase",
        "merge",
        "pull",
      ].includes(arg)
    );
  }

  if (command === "bun" || command === "npm") {
    return args.some((arg) =>
      ["install", "add", "remove", "publish", "run-script"].includes(arg)
    );
  }

  return false;
}
