import type {
  ToolContextPayload,
  ToolOmittedSection,
  ToolResult,
  ToolResultPolicy,
  ToolResultPolicyInput,
  ToolResultPolicyResult,
} from "../types/tool-output.type";

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
