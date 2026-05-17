import type {
  CreateMemoryEntryInput,
  MemoryEntry,
  MemoryQuery,
  MemoryStore,
} from "../types/memory.type";

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries: MemoryEntry[] = [];

  add(input: CreateMemoryEntryInput): Promise<MemoryEntry> {
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      enabled: true,
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    this.entries.push(entry);
    return Promise.resolve(entry);
  }

  listRelevant(query: MemoryQuery): Promise<MemoryEntry[]> {
    return Promise.resolve(
      this.entries.filter((entry) => matchesMemoryQuery(entry, query))
    );
  }

  disable(id: string): Promise<MemoryEntry | undefined> {
    const entry = this.entries.find((candidate) => candidate.id === id);

    if (!entry) {
      return Promise.resolve(undefined);
    }

    entry.enabled = false;
    entry.updatedAt = new Date().toISOString();
    return Promise.resolve(entry);
  }
}

function matchesMemoryQuery(entry: MemoryEntry, query: MemoryQuery): boolean {
  if (!(query.includeDisabled || entry.enabled)) {
    return false;
  }

  if (query.scopes && !query.scopes.includes(entry.scope)) {
    return false;
  }

  if (query.types && !query.types.includes(entry.type)) {
    return false;
  }

  if (
    query.projectId &&
    entry.projectId &&
    entry.projectId !== query.projectId
  ) {
    return false;
  }

  if (query.threadId && entry.threadId && entry.threadId !== query.threadId) {
    return false;
  }

  return true;
}
