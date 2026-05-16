import type { RunContext } from "../types/framework-context.type";
import type { OpenAICompatibleProviderCompatibility } from "../types/provider.type";
import type {
  ToolOutputArtifactStore,
  ToolResultPolicy,
} from "../types/tool-output.type";
import { createFrameworkContextKey } from "./framework-context";

export const runContextKey = createFrameworkContextKey<RunContext>({
  id: "run",
  description: "Current agent run identity.",
});

export const toolArtifactStoreKey =
  createFrameworkContextKey<ToolOutputArtifactStore>({
    id: "tool.artifactStore",
    description: "Stores raw tool output artifacts.",
  });

export const toolResultPolicyKey = createFrameworkContextKey<ToolResultPolicy>({
  id: "tool.resultPolicy",
  description: "Applies runtime policy to optimized tool results.",
});

export const providerCompatibilityKey =
  createFrameworkContextKey<OpenAICompatibleProviderCompatibility>({
    id: "provider.compatibility",
    description: "Provider compatibility options.",
  });
