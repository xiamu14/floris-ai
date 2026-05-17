import { createInterface } from "node:readline";

export async function* readJsonLines(input: NodeJS.ReadableStream) {
  const lines = createInterface({
    input,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    yield JSON.parse(trimmed) as unknown;
  }
}
