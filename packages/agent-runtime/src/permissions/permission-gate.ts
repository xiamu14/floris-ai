import type {
  PermissionCheckRequest,
  PermissionDecision,
  PermissionGate,
} from "../types/permission.type";

export class NoopPermissionGate implements PermissionGate {
  check(request: PermissionCheckRequest): Promise<PermissionDecision> {
    return Promise.resolve({
      decision: "allow",
      source: "default_noop",
      reason: "Default workspace policy allows this tool call.",
      toolName: request.toolName,
      createdAt: new Date().toISOString(),
    });
  }
}
