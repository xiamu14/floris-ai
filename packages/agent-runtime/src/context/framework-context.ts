import type {
  FrameworkContext,
  FrameworkContextEntry,
  FrameworkContextKey,
  FrameworkContextKeyInput,
  FrameworkContextSnapshot,
} from "../types/framework-context.type";

export function createFrameworkContextKey<T>(
  input: FrameworkContextKeyInput
): FrameworkContextKey<T> {
  return {
    id: input.id,
    description: input.description,
  };
}

export function createFrameworkContext(
  entries: Map<string, FrameworkContextValue> = new Map()
): FrameworkContext {
  return new ImmutableFrameworkContext(entries);
}

interface FrameworkContextValue {
  description: string;
  value: unknown;
}

class ImmutableFrameworkContext implements FrameworkContext {
  private readonly entries: Map<string, FrameworkContextValue>;

  constructor(entries: Map<string, FrameworkContextValue>) {
    this.entries = new Map(entries);
  }

  has<T>(key: FrameworkContextKey<T>): boolean {
    return this.entries.has(key.id);
  }

  get<T>(key: FrameworkContextKey<T>): T {
    const entry = this.entries.get(key.id);

    if (!entry) {
      throw new Error(`frameworkContext missing key "${key.id}".`);
    }

    return entry.value as T;
  }

  getOptional<T>(key: FrameworkContextKey<T>): T | undefined {
    return this.entries.get(key.id)?.value as T | undefined;
  }

  set<T>(key: FrameworkContextKey<T>, value: T): FrameworkContext {
    const entries = new Map(this.entries);
    entries.set(key.id, {
      description: key.description,
      value,
    });

    return new ImmutableFrameworkContext(entries);
  }

  pick(keys: FrameworkContextKey<unknown>[]): FrameworkContext {
    const entries = new Map<string, FrameworkContextValue>();

    for (const key of keys) {
      const entry = this.entries.get(key.id);

      if (entry) {
        entries.set(key.id, entry);
      }
    }

    return new ImmutableFrameworkContext(entries);
  }

  describe(): FrameworkContextSnapshot {
    const entries: FrameworkContextEntry[] = [...this.entries.entries()].map(
      ([id, entry]) => ({
        id,
        description: entry.description,
        valueType: typeof entry.value,
      })
    );

    return {
      entries,
    };
  }
}
