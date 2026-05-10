import type {
  ModelProvider,
  OpenAICompatibleProviderOptions,
  ProviderFactoryInput,
} from "../types/provider.type";
import { OpenAICompatibleModelProvider } from "./openai-compatible-provider";
import { readRequiredApiKeyFromEnv } from "./utils/openai-client";

export function createOpenAICompatibleProviderFromEnv(
  input: ProviderFactoryInput,
  env: NodeJS.ProcessEnv = process.env,
  options: Omit<OpenAICompatibleProviderOptions, "apiKey"> = {}
): ModelProvider | undefined {
  if (input.providerConfig.kind !== "openai") {
    return undefined;
  }

  const apiKey = readRequiredApiKeyFromEnv(env, input.providerConfig.apiKeyEnvName );

  // TODO: Error reading API key, return undefined, log error
  if (apiKey instanceof Error) {
    return undefined;
  }

  return new OpenAICompatibleModelProvider(input, {
    ...options,
    apiKey,
  });
}
