import type {
  ToolOutputArtifact,
  ToolOutputArtifactInput,
  ToolOutputArtifactStore,
} from "../types/tool-output.type";

export class InMemoryToolOutputArtifactStore
  implements ToolOutputArtifactStore
{
  private readonly artifacts = new Map<string, string>();

  save(input: ToolOutputArtifactInput): Promise<ToolOutputArtifact> {
    const id = crypto.randomUUID();
    const ref = `tool-output://${id}`;
    const createdAt = new Date().toISOString();

    this.artifacts.set(ref, input.content);

    return Promise.resolve({
      id,
      ref,
      kind: "raw_output",
      mediaType: input.mediaType,
      bytes: byteLength(input.content),
      tokenEstimate: estimateTokens(input.content),
      createdAt,
    });
  }

  read(ref: string): Promise<string | undefined> {
    return Promise.resolve(this.artifacts.get(ref));
  }
}

export function byteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}
