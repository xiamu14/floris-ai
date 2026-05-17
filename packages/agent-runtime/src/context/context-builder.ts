import { DEFAULT_AGENT_ROLE_PROMPTS } from "../prompts/default-agent-role-prompts";
import type {
  ContextBuilder,
  ContextBuildInput,
  ContextBuildResult,
  ContextSection,
  ProjectInstructionDocument,
  SkippedContextSection,
} from "../types/context.type";
import { ProjectInstructionLoader } from "./project-instruction-loader";

export class BasicContextBuilder implements ContextBuilder {
  private readonly projectInstructionLoader = new ProjectInstructionLoader();

  async build(input: ContextBuildInput): Promise<ContextBuildResult> {
    const sections: ContextSection[] = [];
    const skippedSections: SkippedContextSection[] = [];
    const systemPrompt = resolveSystemPrompt(input);

    sections.push({
      kind: "system",
      title: "System prompt",
      content: systemPrompt,
      tokenEstimate: estimateTokens(systemPrompt),
      source: {
        type: "agent_profile",
        ref: input.profile.systemPrompt.promptId,
      },
    });

    if (input.profile.contextPolicy.includeProjectInstructions) {
      const projectInstructions = await this.projectInstructionLoader.load(
        input.workspacePath ?? process.cwd()
      );

      skippedSections.push(...projectInstructions.skipped);

      if (projectInstructions.documents.length > 0) {
        const content = formatProjectInstructions(
          projectInstructions.documents
        );

        sections.push({
          kind: "project_instructions",
          title: "Project instructions",
          content,
          tokenEstimate: estimateTokens(content),
          source: {
            type: "workspace_file",
            ref: projectInstructions.documents
              .map((document) => document.relativePath)
              .join(","),
          },
        });
      }
    }

    if (input.profile.contextPolicy.includeRecentMessages) {
      const content = formatRecentMessages(input.messages);

      sections.push({
        kind: "recent_messages",
        title: "Recent messages",
        content,
        tokenEstimate: estimateTokens(content),
        source: {
          type: "thread",
          ref: `${input.threadId}/${input.branchId}`,
        },
      });
    }

    if (
      input.profile.contextPolicy.includeMemory &&
      input.memoryEntries &&
      input.memoryEntries.length > 0
    ) {
      const content = input.memoryEntries
        .map((entry) => `- [${entry.scope}/${entry.type}] ${entry.content}`)
        .join("\n");

      sections.push({
        kind: "memory",
        title: "Memory",
        content,
        tokenEstimate: estimateTokens(content),
        source: {
          type: "memory",
          ref: input.memoryEntries.map((entry) => entry.id).join(","),
        },
      });
    }

    if (input.toolResults && input.toolResults.length > 0) {
      const content = input.toolResults
        .map(
          (result) =>
            `Tool ${result.toolName} (${result.toolCallId})\n${result.context.content}`
        )
        .join("\n\n");

      sections.push({
        kind: "tool_results",
        title: "Tool results",
        content,
        tokenEstimate: estimateTokens(content),
        source: {
          type: "tool",
          ref: input.toolResults.map((result) => result.toolCallId).join(","),
        },
      });
    }

    const system = sections
      .filter((section) => section.kind !== "recent_messages")
      .map(formatSectionForProvider);
    const tokenEstimate = sections.reduce(
      (total, section) => total + section.tokenEstimate,
      0
    );

    return {
      system,
      messages: input.messages,
      sections,
      skippedSections,
      tokenEstimate,
    };
  }
}

function resolveSystemPrompt(input: ContextBuildInput): string {
  const prompt = DEFAULT_AGENT_ROLE_PROMPTS.find(
    (entry) => entry.systemPrompt.id === input.profile.systemPrompt.promptId
  );

  if (prompt) {
    return prompt.systemPrompt.content;
  }

  return [
    `You are ${input.profile.displayName}, a ${input.profile.role} agent in Floris AI.`,
    "Use available tools when they are relevant. After a tool result, provide a concise final answer.",
  ].join("\n");
}

function formatProjectInstructions(
  documents: ProjectInstructionDocument[]
): string {
  return documents
    .map(
      (document) =>
        `# ${document.relativePath}\n\n${document.content.trimEnd()}`
    )
    .join("\n\n");
}

function formatRecentMessages(messages: ContextBuildInput["messages"]): string {
  return messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
}

function formatSectionForProvider(section: ContextSection): string {
  return `# ${section.title}\n\n${section.content}`;
}

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}
