import { type as arkType } from "arktype";
import type { Tool } from "../types/tool.type";
import {
  collectWorkspaceFiles,
  createToolError,
  createToolSuccess,
  readUtf8File,
  resolveWorkspacePath,
  saveRawArtifact,
  truncateText,
} from "./workspace-tool-utils";

const SearchFilesInput = arkType({
  query: "string",
  "path?": "string",
  "maxFiles?": "number",
  "maxMatches?": "number",
  "contextLines?": "number",
});
const LINE_SPLIT_PATTERN = /\r?\n/;

export const searchFilesTool: Tool = {
  name: "search_files",
  description:
    "Searches workspace text files and returns grouped, capped matches with snippets.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      path: { type: "string" },
      maxFiles: { type: "number" },
      maxMatches: { type: "number" },
      contextLines: { type: "number" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(input, context) {
    const parsed = SearchFilesInput(input);

    if (parsed instanceof arkType.errors) {
      return createToolError({
        summary: "search_files input validation failed.",
        message: String(parsed),
        filterId: "search-files-domain-filter",
      });
    }

    try {
      const maxFiles = Math.min(Math.floor(parsed.maxFiles ?? 40), 120);
      const maxMatches = Math.min(Math.floor(parsed.maxMatches ?? 80), 300);
      const contextLines = Math.min(Math.floor(parsed.contextLines ?? 1), 5);
      const files = await collectWorkspaceFiles({
        workspacePath: context.run.workspacePath,
        startPath: parsed.path ?? ".",
        maxDepth: 10,
        limit: 2000,
      });
      const matches = await collectSearchMatches({
        files,
        workspacePath: context.run.workspacePath,
        query: parsed.query,
        maxFiles,
        maxMatches,
        contextLines,
      });

      const rawOutput = JSON.stringify(matches, null, 2);
      const contextContent =
        matches.length > 0
          ? truncateText(formatSearchMatches(matches), 12_000)
          : `No matches for: ${parsed.query}`;
      const artifacts = await saveRawArtifact(
        context,
        "search_files",
        rawOutput,
        "application/json"
      );

      return createToolSuccess({
        summary: `Found matches in ${matches.length} file(s).`,
        display: contextContent,
        contextContent,
        rawContent: rawOutput,
        artifacts,
        filterId: "search-files-domain-filter",
        strategy: "group_by_pattern",
        data: { matches },
      });
    } catch (error) {
      return createToolError({
        summary: "search_files failed.",
        message: error instanceof Error ? error.message : String(error),
        filterId: "search-files-domain-filter",
      });
    }
  },
};

async function collectSearchMatches(input: {
  files: string[];
  workspacePath: string;
  query: string;
  maxFiles: number;
  maxMatches: number;
  contextLines: number;
}): Promise<
  Array<{
    file: string;
    matches: Array<{
      line: number;
      snippet: string;
    }>;
  }>
> {
  const matches: Array<{
    file: string;
    matches: Array<{
      line: number;
      snippet: string;
    }>;
  }> = [];

  for (const file of input.files) {
    if (
      matches.length >= input.maxFiles ||
      countMatches(matches) >= input.maxMatches
    ) {
      break;
    }

    const fileMatches = await findFileMatches({
      workspacePath: input.workspacePath,
      file,
      query: input.query,
      contextLines: input.contextLines,
      remainingMatches: input.maxMatches - countMatches(matches),
    });

    if (fileMatches.length > 0) {
      matches.push({ file, matches: fileMatches });
    }
  }

  return matches;
}

async function findFileMatches(input: {
  workspacePath: string;
  file: string;
  query: string;
  contextLines: number;
  remainingMatches: number;
}): Promise<
  Array<{
    line: number;
    snippet: string;
  }>
> {
  const absolutePath = resolveWorkspacePath(input.workspacePath, input.file);
  const content = await readUtf8File(absolutePath);
  const lines = content.split(LINE_SPLIT_PATTERN);
  const matches: Array<{
    line: number;
    snippet: string;
  }> = [];

  for (const [index, line] of lines.entries()) {
    if (matches.length >= input.remainingMatches) {
      break;
    }

    if (!line.includes(input.query)) {
      continue;
    }

    matches.push({
      line: index + 1,
      snippet: createSnippet(lines, index, input.contextLines),
    });
  }

  return matches;
}

function createSnippet(
  lines: string[],
  index: number,
  contextLines: number
): string {
  const from = Math.max(index - contextLines, 0);
  const to = Math.min(index + contextLines + 1, lines.length);

  return lines.slice(from, to).join("\n");
}

function formatSearchMatches(
  matches: Array<{
    file: string;
    matches: Array<{
      line: number;
      snippet: string;
    }>;
  }>
): string {
  return matches
    .map((group) =>
      [
        `File: ${group.file}`,
        ...group.matches.map((match) => `  L${match.line}: ${match.snippet}`),
      ].join("\n")
    )
    .join("\n\n");
}

function countMatches(
  matches: Array<{
    matches: Array<{
      line: number;
      snippet: string;
    }>;
  }>
): number {
  return matches.reduce((total, group) => total + group.matches.length, 0);
}
