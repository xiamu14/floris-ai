export interface FrameworkContextKey<T> {
  id: string;
  description: string;
  readonly valueType?: T;
}

export interface FrameworkContextEntry {
  id: string;
  description: string;
  valueType: string;
}

export interface FrameworkContextSnapshot {
  entries: FrameworkContextEntry[];
}

export interface FrameworkContext {
  has<T>(key: FrameworkContextKey<T>): boolean;
  get<T>(key: FrameworkContextKey<T>): T;
  getOptional<T>(key: FrameworkContextKey<T>): T | undefined;
  set<T>(key: FrameworkContextKey<T>, value: T): FrameworkContext;
  pick(keys: FrameworkContextKey<unknown>[]): FrameworkContext;
  describe(): FrameworkContextSnapshot;
}

export interface FrameworkContextKeyInput {
  id: string;
  description: string;
}

export interface RunContext {
  threadId: string;
  branchId: string;
  agentId: string;
  workspacePath: string;
  projectId?: string;
}
