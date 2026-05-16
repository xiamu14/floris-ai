import type {
  ToolContextPayload,
  ToolOmittedSection,
  ToolResult,
  ToolResultPolicy,
  ToolResultPolicyInput,
  ToolResultPolicyResult,
} from "../types/tool-output.type";
import { byteLength, estimateTokens } from "./tool-output-artifact-store";

const READ_FILE_FILTER_ID = "read-file-domain-filter";

export const defaultToolResultPolicy: ToolResultPolicy = {
  apply: applyToolResultPolicy,
};

export function applyToolResultPolicy(
  input: ToolResultPolicyInput
): ToolResultPolicyResult {
  if (input.result.context.tokenEstimate <= input.maxContextTokens) {
    return {
      result: input.result,
      warnings: [],
    };
  }

  if (shouldKeepExcerpt(input.result)) {
    return applyExcerptPolicy(input);
  }

  const rawRef = input.result.artifacts.at(0)?.ref;
  const context = createSummaryOnlyContext(input.result.summary);
  const omitted = createBudgetOmission(input.result, rawRef);

  return {
    result: {
      ...input.result,
      context,
      omitted: [...input.result.omitted, omitted],
      metrics: {
        ...input.result.metrics,
        contextBytes: context.content.length,
        estimatedContextTokens: context.tokenEstimate,
        reductionRatio:
          input.result.metrics.estimatedRawTokens / context.tokenEstimate,
        truncated: true,
      },
    },
    warnings: [
      `Tool context exceeded ${input.maxContextTokens} tokens; downgraded to summary.`,
    ],
  };
}

function shouldKeepExcerpt(result: ToolResult): boolean {
  return (
    result.ok &&
    result.metrics.filterId === READ_FILE_FILTER_ID &&
    result.context.policy === "include"
  );
}

function applyExcerptPolicy(
  input: ToolResultPolicyInput
): ToolResultPolicyResult {
  const rawRef = input.result.artifacts.at(0)?.ref;
  const context = createExcerptContext(
    input.result.context.content,
    input.maxContextTokens
  );
  const omitted = createBudgetOmission(input.result, rawRef);

  return {
    result: {
      ...input.result,
      context,
      omitted: [...input.result.omitted, omitted],
      metrics: {
        ...input.result.metrics,
        contextBytes: byteLength(context.content),
        estimatedContextTokens: context.tokenEstimate,
        reductionRatio:
          input.result.metrics.estimatedRawTokens / context.tokenEstimate,
        truncated: true,
      },
    },
    warnings: [
      `Tool context exceeded ${input.maxContextTokens} tokens; kept a source excerpt.`,
    ],
  };
}

function createExcerptContext(
  content: string,
  maxContextTokens: number
): ToolContextPayload {
  const marker = "\n... truncated by tool context budget";
  const maxChars = Math.max(maxContextTokens * 4 - marker.length, 1);
  const excerpt =
    content.length <= maxChars
      ? content
      : `${content.slice(0, maxChars)}${marker}`;

  return {
    content: excerpt,
    tokenEstimate: estimateTokens(excerpt),
    policy: "include",
  };
}

function createSummaryOnlyContext(summary: string): ToolContextPayload {
  return {
    content: summary,
    tokenEstimate: Math.ceil(summary.length / 4),
    policy: "summary_only",
  };
}

function createBudgetOmission(
  result: ToolResult,
  rawRef: string | undefined
): ToolOmittedSection {
  const omission = {
    reason: "context_budget_exceeded",
    bytes: result.metrics.contextBytes,
    tokenEstimate: result.context.tokenEstimate,
  };

  if (rawRef) {
    return {
      ...omission,
      rawRef,
    };
  }

  return omission;
}
