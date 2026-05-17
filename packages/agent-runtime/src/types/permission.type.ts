export interface PermissionGate {
  check(request: PermissionCheckRequest): Promise<PermissionDecision>;
}

export interface PermissionCheckRequest {
  toolCallId: string;
  agentId: string;
  threadId: string;
  branchId: string;
  toolName: string;
  input: unknown;
  cwd: string;
  riskTags: PermissionRiskTag[];
}

export type PermissionRiskTag =
  | "read_workspace"
  | "write_workspace"
  | "shell"
  | "network"
  | "unknown";

export interface PermissionDecision {
  decision: PermissionDecisionValue;
  source: PermissionDecisionSource;
  reason: string;
  toolName: string;
  createdAt: string;
  ruleId?: string;
}

export type PermissionDecisionValue = "allow" | "deny" | "needs_user_approval";

export type PermissionDecisionSource =
  | "default_noop"
  | "rule"
  | "policy_reviewer"
  | "user";
