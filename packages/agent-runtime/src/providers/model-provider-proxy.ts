import type {
  ModelEvent,
  ModelProvider,
  ModelRequest,
  ProviderTransport,
  ResolvedProviderRef,
} from "../types/provider.type";

export class TransportBackedModelProvider implements ModelProvider {
  readonly id: string;
  private readonly provider: ResolvedProviderRef;
  private readonly transport: ProviderTransport;

  constructor(provider: ResolvedProviderRef, transport: ProviderTransport) {
    this.id = provider.providerId;
    this.provider = provider;
    this.transport = transport;
  }

  createMessage(
    request: ModelRequest,
    signal?: AbortSignal
  ): AsyncIterable<ModelEvent> {
    return this.transport.send(
      {
        ...request,
        provider: this.provider,
      },
      signal
    );
  }
}
