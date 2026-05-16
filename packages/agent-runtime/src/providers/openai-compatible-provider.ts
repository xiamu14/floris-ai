import { providerCompatibilityKey } from "../context/context-keys";
import { createFrameworkContext } from "../context/framework-context";
import { createProviderRequestContext } from "../context/scenarios/provider-request-context";
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
  private readonly apiKey: string | undefined;
  private readonly injectedClient: OpenAIChatCompletionsClient | undefined;
  private cachedClient: OpenAIChatCompletionsClient | undefined;
  private readonly modelId: string;
  private readonly modelParameters: ModelParameters | undefined;
  private readonly providerApiUrl: string;
  private readonly compatibility:
    | ProviderFactoryInput["providerConfig"]["compatibility"]
    | undefined;

  constructor(
    input: ProviderFactoryInput,
    options: OpenAICompatibleProviderOptions = {}
  ) {
    this.id = input.providerId;
    this.apiKey = options.apiKey;
    this.injectedClient = options.client;
    this.modelId = input.modelConfig.modelId;
    this.modelParameters = input.modelConfig.parameters;
    this.providerApiUrl = input.providerConfig.apiUrl;
    this.compatibility = input.providerConfig.compatibility;
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
          createProviderRequestContext(
            this.createProviderFrameworkContext(),
            this.modelParameters
              ? {
                  modelId: this.modelId,
                  modelParameters: this.modelParameters,
                }
              : {
                  modelId: this.modelId,
                }
          )
        ),
        signal ? { signal } : undefined
      );

      yield* toModelEvents(completion);
    } catch (error) {
      yield createErrorEvent(toProviderError(error));
    }
  }

  private resolveClient(): OpenAIChatCompletionsClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }

    if (this.cachedClient) {
      return this.cachedClient;
    }

    this.cachedClient = createOpenAIClient(
      this.apiKey
        ? {
            apiUrl: this.providerApiUrl,
            apiKey: this.apiKey,
          }
        : {
            apiUrl: this.providerApiUrl,
          }
    );

    return this.cachedClient;
  }

  private createProviderFrameworkContext() {
    let frameworkContext = createFrameworkContext();

    if (this.compatibility) {
      frameworkContext = frameworkContext.set(
        providerCompatibilityKey,
        this.compatibility
      );
    }

    return frameworkContext;
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
