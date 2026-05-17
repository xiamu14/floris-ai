import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProjectInstructionDocument,
  ProjectInstructionLoadResult,
  SkippedContextSection,
} from "../types/context.type";

const PROJECT_INSTRUCTION_FILES = ["AGENTS.md", "AGENT.md"];

export class ProjectInstructionLoader {
  async load(workspacePath: string): Promise<ProjectInstructionLoadResult> {
    const documents: ProjectInstructionDocument[] = [];
    const skipped: SkippedContextSection[] = [];

    for (const relativePath of PROJECT_INSTRUCTION_FILES) {
      const fullPath = path.join(workspacePath, relativePath);

      try {
        documents.push({
          relativePath,
          content: await readFile(fullPath, "utf8"),
        });
      } catch (error) {
        skipped.push(toSkippedProjectInstruction(relativePath, error));
      }
    }

    return {
      documents,
      skipped,
    };
  }
}

function toSkippedProjectInstruction(
  relativePath: string,
  error: unknown
): SkippedContextSection {
  const nodeError = error as NodeJS.ErrnoException;

  if (nodeError.code === "ENOENT") {
    return {
      kind: "project_instructions",
      title: "Project instructions",
      reason: `${relativePath} was not found in the workspace root.`,
      source: {
        type: "workspace_file",
        ref: relativePath,
      },
    };
  }

  return {
    kind: "project_instructions",
    title: "Project instructions",
    reason: `Could not read ${relativePath}.`,
    source: {
      type: "workspace_file",
      ref: relativePath,
    },
    error: {
      code: nodeError.code ?? "read_failed",
      message: nodeError.message,
    },
  };
}
