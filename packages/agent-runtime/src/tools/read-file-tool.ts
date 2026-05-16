import { stat } from "node:fs/promises";
import { type as arkType } from "arktype";
import type { Tool } from "../types/tool.type";
import {
  createToolError,
  createToolSuccess,
  readUtf8File,
  resolveWorkspacePath,
  saveRawArtifact,
  sliceTextByLines,
  toWorkspaceRelativePath,
  truncateText,
} from "./workspace-tool-utils";

const ReadFileInput = arkType({
  path: "string",
  "startLine?": "number",
  "maxLines?": "number",
  "maxBytes?": "number",
});
const LINE_SPLIT_PATTERN = /\r?\n/;

export const readFileTool: Tool = {
  name: "read_file",
  description:
    "Reads a UTF-8 text file from the workspace with line and byte limits.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      startLine: { type: "number" },
      maxLines: { type: "number" },
      maxBytes: { type: "number" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async execute(input, context) {
    const parsed = ReadFileInput(input);

    if (parsed instanceof arkType.errors) {
      return createToolError({
        summary: "read_file input validation failed.",
        message: String(parsed),
        filterId: "read-file-domain-filter",
      });
    }

    try {
      const absolutePath = resolveWorkspacePath(
        context.run.workspacePath,
        parsed.path
      );
      const fileStat = await stat(absolutePath);

      if (!fileStat.isFile()) {
        return createToolError({
          summary: "read_file failed.",
          message: `Path is not a file: ${parsed.path}`,
          filterId: "read-file-domain-filter",
        });
      }

      const rawOutput = await readUtf8File(absolutePath);
      const startLine = Math.max(Math.floor(parsed.startLine ?? 1), 1);
      const maxLines = Math.min(Math.floor(parsed.maxLines ?? 160), 800);
      const maxBytes = Math.min(Math.floor(parsed.maxBytes ?? 16_000), 80_000);
      const sliced = sliceTextByLines(rawOutput, startLine, maxLines);
      const bounded = truncateText(sliced, maxBytes);
      const relativePath = toWorkspaceRelativePath(
        context.run.workspacePath,
        absolutePath
      );
      const contextContent = `File: ${relativePath}\nLines: ${startLine}-${startLine + bounded.split(LINE_SPLIT_PATTERN).length - 1}\n\n${bounded}`;
      const artifacts = await saveRawArtifact(
        context,
        "read_file",
        rawOutput,
        "text/plain"
      );

      return createToolSuccess({
        summary: `Read ${relativePath}.`,
        display: contextContent,
        contextContent,
        rawContent: rawOutput,
        artifacts,
        filterId: "read-file-domain-filter",
        strategy: "tail_head",
        data: {
          path: relativePath,
          startLine,
          maxLines,
          fileBytes: fileStat.size,
        },
      });
    } catch (error) {
      return createToolError({
        summary: "read_file failed.",
        message: error instanceof Error ? error.message : String(error),
        filterId: "read-file-domain-filter",
      });
    }
  },
};
