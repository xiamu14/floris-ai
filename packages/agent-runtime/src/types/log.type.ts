import type { ModelProvider } from "./provider.type";
import type { SessionStore } from "./session.type";

export interface DebugLogger {
  log(
    groupName: string,
    step: string,
    message: string,
    payload?: unknown
  ): void;
}

export interface DebugLoggerOptions {
  debug?: boolean;
}

export interface DebugSessionStoreInput {
  logger: DebugLogger;
  store: SessionStore;
}

export interface DebugModelProviderInput {
  logger: DebugLogger;
  provider: ModelProvider;
}
