import type { DebugModelProviderInput } from "../../types/log.type";
import type {
  ModelEvent,
  ModelProvider,
  ModelRequest,
} from "../../types/provider.type";
import type { TokenUsage } from "../../types/runtime.type";

export class DebugModelProvider implements ModelProvider {
  readonly id: string;
  private readonly input: DebugModelProviderInput;
  private callCount = 0;

  constructor(input: DebugModelProviderInput) {
    this.id = input.provider.id;
    this.input = input;
  }

  async *createMessage(
    request: ModelRequest,
    signal?: AbortSignal
  ): AsyncIterable<ModelEvent> {
    const callId = this.callCount;
    this.callCount += 1;
    const startedAt = Date.now();
    const usage = createEmptyUsage();
    let eventCount = 0;
    let stopReason = "unknown";

    this.input.logger.log(
      "agentLoop",
      "createMessage",
      `provider request #${callId}`,
      {
        callId,
        request,
      }
    );

    for await (const event of this.input.provider.createMessage(
      request,
      signal
    )) {
      eventCount += 1;
      this.input.logger.log("provider", "event", `#${callId} ${event.type}`, {
        callId,
        event,
      });

      if (event.type === "usage") {
        usage.inputTokens += event.usage.inputTokens;
        usage.outputTokens += event.usage.outputTokens;
        usage.totalTokens += event.usage.totalTokens;
      }

      if (event.type === "done") {
        stopReason = event.stopReason;
      }

      if (event.type === "error") {
        stopReason = "provider_error";
      }

      yield event;
    }

    this.input.logger.log("provider", "usage", `finish message #${callId}`, {
      callId,
      durationMs: Date.now() - startedAt,
      eventCount,
      stopReason,
      usage,
    });
  }
}

function createEmptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}
