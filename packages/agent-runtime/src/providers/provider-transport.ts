import type {
  ModelEvent,
  ModelProviderError,
  ProviderTransport,
  ProviderTransportRequest,
} from "../types/provider.type";

export class MockProviderTransport implements ProviderTransport {
  private cursor = 0;
  private readonly script: ModelEvent[];

  constructor(script: ModelEvent[]) {
    this.script = script;
  }

  async *send(
    _request: ProviderTransportRequest,
    signal?: AbortSignal
  ): AsyncIterable<ModelEvent> {
    await Promise.resolve();

    while (this.cursor < this.script.length) {
      if (signal?.aborted) {
        return;
      }

      const event = this.script[this.cursor];
      this.cursor += 1;

      if (!event) {
        return;
      }

      yield event;

      if (event.type === "done" || event.type === "error") {
        return;
      }
    }
  }
}

export function createProviderErrorEvent(
  error: ModelProviderError
): ModelEvent {
  return {
    type: "error",
    error,
  };
}
