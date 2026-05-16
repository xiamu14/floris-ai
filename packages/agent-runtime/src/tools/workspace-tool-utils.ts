import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ToolExecutionContext } from "../types/tool.type";
import type {
  ToolOmittedSection,
  ToolOutputArtifact,
  ToolOutputMetrics,
  ToolResult,
} from "../types/tool-output.type";
import { byteLength, estimateTokens } from "./tool-output-artifact-store";

const execFileAsync = promisify(execFile);
const LINE_SPLIT_PATTERN = /\r?\n/;

const DEFAULT_IGNORED_NAMES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "graphify-out",
]);

export function resolveWorkspacePath(
  workspacePath: string,
  requestedPath?: string
): string {
  const workspaceRoot = path.resolve(workspacePath);
  const targetPath = path.resolve(workspaceRoot, requestedPath ?? ".");

  if (
    targetPath === workspaceRoot ||
    targetPath.startsWith(`${workspaceRoot}${path.sep}`)
  ) {
    return targetPath;
  }

  throw new Error(`Path is outside workspace: ${requestedPath ?? "."}`);
}

export function toWorkspaceRelativePath(
  workspacePath: string,
  absolutePath: string
): string {
  const relativePath = path.relative(path.resolve(workspacePath), absolutePath);

  return relativePath.length > 0 ? relativePath : ".";
}

export function shouldIgnorePath(absolutePath: string): boolean {
  return absolutePath
    .split(path.sep)
    .some((part) => DEFAULT_IGNORED_NAMES.has(part));
}

export async function collectWorkspaceFiles(input: {
  workspacePath: string;
  startPath?: string;
  maxDepth: number;
  limit: number;
}): Promise<string[]> {
  const rootPath = resolveWorkspacePath(input.workspacePath, input.startPath);
  const files: string[] = [];

  await walkWorkspacePath(
    rootPath,
    input.workspacePath,
    input.maxDepth,
    files,
    input.limit
  );

  return files;
}

export async function runWorkspaceCommand(input: {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}> {
  try {
    const result = await execFileAsync(input.command, input.args, {
      cwd: input.cwd,
      timeout: input.timeoutMs,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 4,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      timedOut: false,
    };
  } catch (error) {
    return {
      stdout: toExecOutput(error, "stdout"),
      stderr: toExecOutput(error, "stderr"),
      exitCode: toExecExitCode(error),
      timedOut: toExecTimedOut(error),
    };
  }
}

export async function saveRawArtifact(
  context: ToolExecutionContext,
  toolName: string,
  content: string,
  mediaType: string
): Promise<ToolOutputArtifact[]> {
  const artifact = await context.artifactStore?.save({
    toolName,
    threadId: context.run.threadId,
    branchId: context.run.branchId,
    content,
    mediaType,
  });

  return artifact ? [artifact] : [];
}

export function createToolSuccess(input: {
  summary: string;
  display: string;
  contextContent: string;
  rawContent: string;
  artifacts: ToolOutputArtifact[];
  filterId: string;
  strategy: ToolOutputMetrics["strategy"];
  data?: unknown;
}): ToolResult {
  const contextTokens = estimateTokens(input.contextContent);
  const rawTokens = estimateTokens(input.rawContent);
  const rawRef = input.artifacts.at(0)?.ref;
  const omittedBytes = Math.max(
    byteLength(input.rawContent) - byteLength(input.contextContent),
    0
  );
  const omittedTokens = Math.max(rawTokens - contextTokens, 0);
  const hasOmittedContent = omittedBytes > 0 || omittedTokens > 0;
  const omitted: ToolOmittedSection[] = hasOmittedContent
    ? [
        {
          reason: "tool_domain_filter",
          ...(rawRef ? { rawRef } : {}),
          bytes: omittedBytes,
          tokenEstimate: omittedTokens,
        },
      ]
    : [];

  return {
    ok: true,
    summary: input.summary,
    display: input.display,
    context: {
      content: input.contextContent,
      tokenEstimate: contextTokens,
      policy: "include",
    },
    artifacts: input.artifacts,
    metrics: {
      rawBytes: byteLength(input.rawContent),
      contextBytes: byteLength(input.contextContent),
      estimatedRawTokens: rawTokens,
      estimatedContextTokens: contextTokens,
      reductionRatio: rawTokens / Math.max(contextTokens, 1),
      truncated: hasOmittedContent,
      filterId: input.filterId,
      strategy: input.strategy,
    },
    omitted,
    ...(input.data ? { data: input.data } : {}),
  };
}

export function createToolError(input: {
  summary: string;
  message: string;
  filterId: string;
  recoverable?: boolean;
}): ToolResult {
  const tokenEstimate = estimateTokens(input.message);

  return {
    ok: false,
    summary: input.summary,
    display: input.message,
    context: {
      content: `Tool error: ${input.message}`,
      tokenEstimate,
      policy: "include",
    },
    artifacts: [],
    metrics: {
      rawBytes: byteLength(input.message),
      contextBytes: byteLength(input.message),
      estimatedRawTokens: tokenEstimate,
      estimatedContextTokens: tokenEstimate,
      reductionRatio: 1,
      truncated: false,
      filterId: input.filterId,
      strategy: "structure_only",
    },
    omitted: [],
    error: {
      code: "tool_error",
      message: input.message,
      recoverable: input.recoverable ?? true,
    },
  };
}

export function sliceTextByLines(
  content: string,
  startLine: number,
  maxLines: number
): string {
  return content
    .split(LINE_SPLIT_PATTERN)
    .slice(Math.max(startLine - 1, 0), Math.max(startLine - 1, 0) + maxLines)
    .join("\n");
}

export function truncateText(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}\n... truncated ${content.length - maxChars} character(s)`;
}

export async function readUtf8File(absolutePath: string): Promise<string> {
  const buffer = await readFile(absolutePath);

  return buffer.toString("utf8");
}

async function walkWorkspacePath(
  absolutePath: string,
  workspacePath: string,
  depthRemaining: number,
  files: string[],
  limit: number
): Promise<void> {
  if (files.length >= limit || shouldIgnorePath(absolutePath)) {
    return;
  }

  const currentStat = await stat(absolutePath);

  if (currentStat.isFile()) {
    files.push(toWorkspaceRelativePath(workspacePath, absolutePath));
    return;
  }

  if (!(currentStat.isDirectory() && depthRemaining >= 0)) {
    return;
  }

  const entries = await readdir(absolutePath, { withFileTypes: true });

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    if (files.length >= limit) {
      return;
    }

    const entryPath = path.join(absolutePath, entry.name);

    if (shouldIgnorePath(entryPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await walkWorkspacePath(
        entryPath,
        workspacePath,
        depthRemaining - 1,
        files,
        limit
      );
      continue;
    }

    if (entry.isFile()) {
      files.push(toWorkspaceRelativePath(workspacePath, entryPath));
    }
  }
}

function toExecOutput(error: unknown, key: "stdout" | "stderr"): string {
  if (typeof error === "object" && error !== null && key in error) {
    const value = error[key as keyof typeof error];

    return typeof value === "string" ? value : "";
  }

  return "";
}

function toExecExitCode(error: unknown): number {
  if (typeof error === "object" && error !== null && "code" in error) {
    const value = error.code;

    return typeof value === "number" ? value : 1;
  }

  return 1;
}

function toExecTimedOut(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "signal" in error &&
    error.signal === "SIGTERM"
  );
}
