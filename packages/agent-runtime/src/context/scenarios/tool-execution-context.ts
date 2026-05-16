import type { FrameworkContext } from "../../types/framework-context.type";
import type { ToolExecutionContext } from "../../types/tool.type";
import {
  runContextKey,
  toolArtifactStoreKey,
  toolResultPolicyKey,
} from "../context-keys";

export function createToolExecutionContext(
  frameworkContext: FrameworkContext
): ToolExecutionContext {
  const artifactStore = frameworkContext.getOptional(toolArtifactStoreKey);
  const context = {
    run: frameworkContext.get(runContextKey),
    resultPolicy: frameworkContext.get(toolResultPolicyKey),
  };

  return artifactStore
    ? {
        ...context,
        artifactStore,
      }
    : context;
}
