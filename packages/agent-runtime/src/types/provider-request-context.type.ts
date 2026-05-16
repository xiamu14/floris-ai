import type {
  ModelParameters,
  OpenAICompatibleProviderCompatibility,
} from "./provider.type";

export interface ProviderRequestContext {
  modelId: string;
  modelParameters?: ModelParameters;
  compatibility?: OpenAICompatibleProviderCompatibility;
}
