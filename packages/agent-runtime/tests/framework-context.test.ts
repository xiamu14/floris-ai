import { describe, expect, it } from "vitest";
import {
  createFrameworkContext,
  createFrameworkContextKey,
} from "../src/context/framework-context";

describe("framework context", () => {
  it("stores typed values immutably", () => {
    const key = createFrameworkContextKey<{ id: string }>({
      id: "test.value",
      description: "Test value.",
    });
    const emptyContext = createFrameworkContext();
    const context = emptyContext.set(key, { id: "value" });

    expect(emptyContext.has(key)).toBe(false);
    expect(context.has(key)).toBe(true);
    expect(context.get(key)).toEqual({ id: "value" });
    expect(context.getOptional(key)).toEqual({ id: "value" });
  });

  it("can describe and pick entries", () => {
    const firstKey = createFrameworkContextKey<string>({
      id: "test.first",
      description: "First value.",
    });
    const secondKey = createFrameworkContextKey<number>({
      id: "test.second",
      description: "Second value.",
    });
    const context = createFrameworkContext()
      .set(firstKey, "first")
      .set(secondKey, 2);
    const picked = context.pick([firstKey]);

    expect(picked.has(firstKey)).toBe(true);
    expect(picked.has(secondKey)).toBe(false);
    expect(context.describe()).toEqual({
      entries: [
        {
          id: "test.first",
          description: "First value.",
          valueType: "string",
        },
        {
          id: "test.second",
          description: "Second value.",
          valueType: "number",
        },
      ],
    });
  });
});
