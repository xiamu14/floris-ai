import type { AgentRole, ModelRef } from "../types/agent.type";
import type {
  AgentRuntimeConfig,
  ModelConfig,
  ModelProviderFactory,
  ProviderResolutionErrorCode,
  ProviderResolutionFailure,
  ProviderResolutionIssue,
  ProviderResolutionResult,
  ProviderResolutionSuccess,
  RoleModelConfig,
} from "../types/provider.type";

export function resolveProviderForRole(
  config: AgentRuntimeConfig,
  requestedRole: AgentRole,
  createProvider: ModelProviderFactory
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
    const resolved = resolveModelProvider(
      config,
      modelRef,
      createProvider,
      issues
    );

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

  return fail(
    "provider_unavailable",
    `No provider is available for agent role "${roleConfig.role}".`,
    issues
  );
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
  createProvider: ModelProviderFactory,
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

  const provider = createProvider({
    providerId: modelConfig.providerId,
    providerConfig,
    modelConfig,
  });

  if (!provider) {
    issues.push({
      code: "provider_unavailable",
      message: `Provider "${modelConfig.providerId}" is not available.`,
    });
    return undefined;
  }

  return {
    provider,
    model: toModelRef(modelConfig),
    providerConfig,
    modelConfig,
  };
}

function toModelRef(modelConfig: ModelConfig): ModelRef {
  return {
    providerId: modelConfig.providerId,
    modelId: modelConfig.modelId,
  };
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
