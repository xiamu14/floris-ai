import { type as arkType } from "arktype";
import type { Tool } from "../types/tool.type";
import {
  collectWorkspaceFiles,
  createToolError,
  createToolSuccess,
  saveRawArtifact,
} from "./workspace-tool-utils";

const ListFilesInput = arkType({
  "path?": "string",
  "maxDepth?": "number",
  "limit?": "number",
});

export const listFilesTool: Tool = {
  name: "list_files",
  description:
    "Lists workspace files with depth and result limits. Skips common generated directories.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      maxDepth: { type: "number" },
      limit: { type: "number" },
    },
    additionalProperties: false,
  },
  async execute(input, context) {
    const parsed = ListFilesInput(input);

    if (parsed instanceof arkType.errors) {
      return createToolError({
        summary: "list_files input validation failed.",
        message: String(parsed),
        filterId: "list-files-domain-filter",
      });
    }

    try {
      const files = await collectWorkspaceFiles({
        workspacePath: context.run.workspacePath,
        startPath: parsed.path ?? ".",
        maxDepth: Math.min(parsed.maxDepth ?? 3, 8),
        limit: Math.min(parsed.limit ?? 120, 500),
      });
      const rawOutput = files.join("\n");
      const contextContent =
        files.length > 0
          ? `Files (${files.length}):\n${rawOutput}`
          : "No files found.";
      const artifacts = await saveRawArtifact(
        context,
        "list_files",
        rawOutput,
        "text/plain"
      );

      return createToolSuccess({
        summary: `Listed ${files.length} file(s).`,
        display: contextContent,
        contextContent,
        rawContent: rawOutput,
        artifacts,
        filterId: "list-files-domain-filter",
        strategy: "structure_only",
        data: { files },
      });
    } catch (error) {
      return createToolError({
        summary: "list_files failed.",
        message: error instanceof Error ? error.message : String(error),
        filterId: "list-files-domain-filter",
      });
    }
  },
};
