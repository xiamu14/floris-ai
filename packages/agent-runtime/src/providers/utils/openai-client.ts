import OpenAI from "openai";
import type {
  OpenAIChatCompletionsClient,
  OpenAIClientConfig,
} from "../../types/provider.type";

export function createOpenAIClient(
  input: OpenAIClientConfig
): OpenAIChatCompletionsClient {
  return new OpenAI({
    apiKey: input.apiKey,
    baseURL: input.apiUrl,
  });
}

export function readRequiredApiKeyFromEnv(
  env: NodeJS.ProcessEnv,
  envName: string
): string | Error {
  const apiKey = env[envName];

  if (!apiKey) {
    return new Error(`Environment variable "${envName}" is not set.`);
  }

  return apiKey;
}
