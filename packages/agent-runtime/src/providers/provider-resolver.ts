import type { AgentRole, ModelRef } from "../types/agent.type";
import type {
  AgentRuntimeConfig,
  ModelConfig,
  ProviderCreationResult,
  ProviderFactoryInput,
  ProviderResolutionErrorCode,
  ProviderResolutionFailure,
  ProviderResolutionIssue,
  ProviderResolutionOptions,
  ProviderResolutionResult,
  ProviderResolutionSuccess,
  RoleModelConfig,
} from "../types/provider.type";
import { createOpenAICompatibleProviderFromEnv } from "./openai-compatible-provider-factory";

export function resolveProviderForRole(
  config: AgentRuntimeConfig,
  requestedRole: AgentRole,
  options: ProviderResolutionOptions = {}
): ProviderResolutionResult {
  const issues: ProviderResolutionIssue[] = [];
  const roleConfig = resolveRoleConfig(config, requestedRole, issues);

  if (!roleConfig) {
    return fail(
      "missing_default_role",
      "Default agent role is not configured.",
      issues
    );
  }

  for (const modelRef of [
    roleConfig.modelRef,
    ...roleConfig.fallbackModelRefs,
  ]) {
    const resolved = resolveModelProvider(config, modelRef, options, issues);

    if (resolved) {
      return {
        ok: true,
        role: roleConfig.role,
        modelRef,
        ...resolved,
        issues,
      };
    }
  }

  return failFromIssues(roleConfig.role, issues);
}

function resolveRoleConfig(
  config: AgentRuntimeConfig,
  requestedRole: AgentRole,
  issues: ProviderResolutionIssue[]
): RoleModelConfig | undefined {
  const requested = config.agents[requestedRole];

  if (requested) {
    return requested;
  }

  issues.push({
    code: "missing_agent_role",
    message: `Agent role "${requestedRole}" is not configured. Falling back to "${config.defaultRole}".`,
  });

  return config.agents[config.defaultRole];
}

function resolveModelProvider(
  config: AgentRuntimeConfig,
  modelRef: string,
  options: ProviderResolutionOptions,
  issues: ProviderResolutionIssue[]
):
  | Omit<ProviderResolutionSuccess, "ok" | "role" | "modelRef" | "issues">
  | undefined {
  const modelConfig = config.models[modelRef];

  if (!modelConfig) {
    issues.push({
      code: "missing_model_ref",
      message: `Model ref "${modelRef}" is not configured.`,
    });
    return undefined;
  }

  const providerConfig = config.providers[modelConfig.providerId];

  if (!providerConfig) {
    issues.push({
      code: "missing_provider",
      message: `Provider "${modelConfig.providerId}" is not configured.`,
    });
    return undefined;
  }

  const result = createProvider(
    {
      providerId: modelConfig.providerId,
      providerConfig,
      modelConfig,
    },
    options
  );

  if (!result.ok) {
    issues.push({
      code: result.error.code,
      message: result.error.message,
    });
    return undefined;
  }

  return {
    provider: result.provider,
    model: toModelRef(modelConfig),
    providerConfig,
    modelConfig,
  };
}

function createProvider(
  input: ProviderFactoryInput,
  options: ProviderResolutionOptions
): ProviderCreationResult {
  const providerType = options.providerType ?? "openai-compatible";

  if (providerType === "openai-compatible") {
    return createOpenAICompatibleProviderFromEnv(
      input,
      options.env,
      options.openAIOptions
    );
  }

  return {
    ok: false,
    error: {
      code: "unsupported_provider_type",
      message: `Provider type "${providerType}" is not supported.`,
    },
  };
}

function toModelRef(modelConfig: ModelConfig): ModelRef {
  return {
    providerId: modelConfig.providerId,
    modelId: modelConfig.modelId,
  };
}

function failFromIssues(
  role: AgentRole,
  issues: ProviderResolutionIssue[]
): ProviderResolutionFailure {
  const lastIssue = issues.at(-1);

  if (lastIssue && isResolutionErrorCode(lastIssue.code)) {
    return fail(lastIssue.code, lastIssue.message, issues);
  }

  return fail(
    "provider_unavailable",
    `No provider is available for agent role "${role}".`,
    issues
  );
}

function isResolutionErrorCode(
  code: ProviderResolutionIssue["code"] | ProviderResolutionErrorCode
): code is ProviderResolutionErrorCode {
  return code !== "missing_agent_role";
}

function fail(
  code: ProviderResolutionErrorCode,
  message: string,
  issues: ProviderResolutionIssue[]
): ProviderResolutionFailure {
  return {
    ok: false,
    error: {
      code,
      message,
    },
    issues,
  };
}
