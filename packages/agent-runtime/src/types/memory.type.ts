export interface MemoryStore {
  add(entry: CreateMemoryEntryInput): Promise<MemoryEntry>;
  listRelevant(query: MemoryQuery): Promise<MemoryEntry[]>;
  disable(id: string): Promise<MemoryEntry | undefined>;
}

export interface MemoryEntry {
  id: string;
  scope: MemoryScope;
  type: MemoryType;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  source: MemorySource;
  projectId?: string;
  threadId?: string;
}

export type MemoryScope = "global" | "project" | "thread";

export type MemoryType =
  | "preference"
  | "architecture_decision"
  | "coding_rule"
  | "known_issue"
  | "summary";

export type MemorySource =
  | "user"
  | "agent_suggestion"
  | "compaction"
  | "import";

export interface CreateMemoryEntryInput {
  scope: MemoryScope;
  type: MemoryType;
  content: string;
  source: MemorySource;
  projectId?: string;
  threadId?: string;
}

export interface MemoryQuery {
  scopes?: MemoryScope[];
  types?: MemoryType[];
  projectId?: string;
  threadId?: string;
  includeDisabled?: boolean;
}
