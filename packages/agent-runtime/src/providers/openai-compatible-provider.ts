import type {
  ModelEvent,
  ModelParameters,
  ModelProvider,
  ModelRequest,
  OpenAIChatCompletionsClient,
  OpenAICompatibleProviderOptions,
  ProviderFactoryInput,
} from "../types/provider.type";
import { createOpenAIClient } from "./utils/openai-client";
import {
  createErrorEvent,
  toModelEvents,
  toProviderError,
} from "./utils/openai-event-mapper";
import { toOpenAIChatCompletionRequest } from "./utils/openai-request-mapper";

export class OpenAICompatibleModelProvider implements ModelProvider {
  readonly id: string;
  private readonly apiKey: string;
  private readonly client: OpenAIChatCompletionsClient | undefined;
  private readonly modelId: string;
  private readonly modelParameters: ModelParameters | undefined;
  private readonly providerApiUrl: string;

  constructor(
    input: ProviderFactoryInput,
    options: OpenAICompatibleProviderOptions = {apiKey:''}
  ) {
    this.id = input.providerId;
    this.apiKey = options.apiKey;
    this.client = options.client;
    this.modelId = input.modelConfig.modelId;
    this.modelParameters = input.modelConfig.parameters;
    this.providerApiUrl = input.providerConfig.apiUrl;
  }

  async *createMessage(
    request: ModelRequest,
    signal?: AbortSignal
  ): AsyncIterable<ModelEvent> {
    const client = this.resolveClient();

    try {
      const completion = await client.chat.completions.create(
        toOpenAIChatCompletionRequest(
          request,
          this.modelId,
          this.modelParameters
        ),
        signal ? { signal } : undefined
      );

      yield* toModelEvents(completion);
    } catch (error) {
      yield createErrorEvent(toProviderError(error));
    }
  }

  private resolveClient(): OpenAIChatCompletionsClient {
    if (this.client) {
      return this.client;
    }

    console.log('[resolveClient]why?', )

    return createOpenAIClient({
      apiUrl: this.providerApiUrl,
      apiKey: this.apiKey,
    });

  }
}

export function createOpenAICompatibleProvider(
  input: ProviderFactoryInput,
  options?: OpenAICompatibleProviderOptions
): ModelProvider | undefined {
  if (input.providerConfig.kind !== "openai") {
    return undefined;
  }

  return new OpenAICompatibleModelProvider(input, options);
}
