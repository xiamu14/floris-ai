import type {
  BuildRunGraphInput,
  RunGraph,
  RunGraphDiagnostic,
  RunGraphEdge,
  RunGraphEventShape,
  RunGraphMetrics,
  RunGraphModelEventShape,
  RunGraphNode,
  RunGraphNodeKind,
  RunGraphNodeStatus,
  RunGraphPermissionDecisionShape,
  RunGraphToolResultShape,
} from "../types/run-graph.type";
import type { AgentEvent, LoopStopReason } from "../types/runtime.type";

const CONTEXT_BUDGET_WARNING_TOKENS = 8000;

export function buildRunGraph(input: BuildRunGraphInput): RunGraph {
  const nodes = input.events.flatMap(toRunGraphNode);
  const edges = buildRunGraphEdges(nodes, input.events);
  const graph: RunGraph = {
    schemaVersion: 1,
    runId: input.runId ?? input.events.at(0)?.id ?? "run.empty",
    threadId: input.events.at(0)?.threadId ?? "",
    branchId: input.events.at(0)?.branchId ?? "",
    startedAt: input.events.at(0)?.createdAt ?? "",
    ...getRunGraphEnd(input.events),
    ...getRunGraphStop(input.events),
    nodes,
    edges,
    metrics: createRunGraphMetrics(input.events),
    diagnostics: [],
  };

  return {
    ...graph,
    diagnostics: validateRunGraph(graph),
  };
}

export function validateRunGraph(graph: RunGraph): RunGraphDiagnostic[] {
  const diagnostics: RunGraphDiagnostic[] = [];

  diagnostics.push(...findMissingStop(graph));
  diagnostics.push(...findToolWithoutPermission(graph));
  diagnostics.push(...findPermissionDeniedButExecuted(graph));
  diagnostics.push(...findProviderMaxTokensWithoutStop(graph));
  diagnostics.push(...findRepeatedToolCalls(graph));
  diagnostics.push(...findHighContextBudget(graph));
  diagnostics.push(...findUnlinkedEvents(graph));

  return diagnostics;
}

function toRunGraphNode(event: AgentEvent): RunGraphNode[] {
  const kind = getNodeKind(event.type);

  if (!kind) {
    return [];
  }

  return [
    {
      id: event.id,
      kind,
      label: getNodeLabel(event, kind),
      status: getNodeStatus(event),
      timestamp: event.createdAt,
      eventId: event.id,
      ...getIteration(event),
      payloadSummary: summarizePayload(event),
      ...getNodeMetrics(event),
    },
  ];
}

function getNodeKind(type: string): RunGraphNodeKind | undefined {
  if (type === "user_message") {
    return "user_message";
  }

  if (type === "context_built") {
    return "context_build";
  }

  if (type === "model_request_started") {
    return "model_request";
  }

  if (type.startsWith("provider_")) {
    return "provider_event";
  }

  if (type === "permission_checked") {
    return "permission";
  }

  if (type === "tool_started") {
    return "tool_call";
  }

  if (type === "tool_finished") {
    return "tool_result";
  }

  if (type === "forced_synthesis_started") {
    return "final_synthesis";
  }

  if (type === "stop") {
    return "stop";
  }

  return undefined;
}

function getNodeLabel(event: AgentEvent, kind: RunGraphNodeKind): string {
  const payload = toPayloadShape(event.payload);

  if (kind === "model_request") {
    return `model request ${payload.iteration ?? ""}`.trim();
  }

  if (kind === "provider_event") {
    return `provider ${event.type.replace("provider_", "")}`;
  }

  if (kind === "permission") {
    const decision = toPermissionDecision(payload.decision);
    return `permission ${decision.decision ?? "checked"}`;
  }

  if (kind === "tool_call") {
    return `tool ${getToolCallName(payload.toolCall) ?? "started"}`;
  }

  if (kind === "tool_result") {
    return `tool result ${payload.toolCallId ?? ""}`.trim();
  }

  if (kind === "final_synthesis") {
    return "final synthesis";
  }

  if (kind === "stop") {
    return `stop ${payload.stopReason ?? ""}`.trim();
  }

  return kind.replace("_", " ");
}

function getNodeStatus(event: AgentEvent): RunGraphNodeStatus {
  const payload = toPayloadShape(event.payload);

  if (event.type === "model_request_started" || event.type === "tool_started") {
    return "running";
  }

  if (event.type === "provider_error") {
    return "error";
  }

  if (event.type === "permission_checked") {
    const decision = toPermissionDecision(payload.decision);
    return decision.decision === "allow" ? "success" : "error";
  }

  if (event.type === "tool_finished") {
    const result = toToolResult(payload.result);
    return result.ok === false ? "error" : "success";
  }

  if (event.type === "stop") {
    return isErrorStopReason(payload.stopReason) ? "error" : "success";
  }

  return "success";
}

function buildRunGraphEdges(
  nodes: RunGraphNode[],
  events: AgentEvent[]
): RunGraphEdge[] {
  const edges: RunGraphEdge[] = [];

  for (let index = 1; index < nodes.length; index += 1) {
    const source = nodes[index - 1];
    const target = nodes[index];

    if (source && target) {
      edges.push({
        id: `transition.${source.id}.${target.id}`,
        source: source.id,
        target: target.id,
        kind: "transition",
      });
    }
  }

  edges.push(...buildContainsEdges(events));
  edges.push(...buildToolCauseEdges(events));

  return dedupeEdges(edges);
}

function buildContainsEdges(events: AgentEvent[]): RunGraphEdge[] {
  const edges: RunGraphEdge[] = [];
  const modelRequestByIteration = new Map<number, string>();

  for (const event of events) {
    const payload = toPayloadShape(event.payload);

    if (
      event.type === "model_request_started" &&
      typeof payload.iteration === "number"
    ) {
      modelRequestByIteration.set(payload.iteration, event.id);
    }

    if (
      event.type.startsWith("provider_") &&
      typeof payload.iteration === "number"
    ) {
      const modelRequestId = modelRequestByIteration.get(payload.iteration);

      if (modelRequestId) {
        edges.push({
          id: `contains.${modelRequestId}.${event.id}`,
          source: modelRequestId,
          target: event.id,
          kind: "contains",
        });
      }
    }
  }

  return edges;
}

function buildToolCauseEdges(events: AgentEvent[]): RunGraphEdge[] {
  const toolStartedById = indexToolStartedEvents(events);

  return events.flatMap((event) =>
    createToolCauseEdgeForEvent(event, toolStartedById)
  );
}

function indexToolStartedEvents(events: AgentEvent[]): Map<string, string> {
  const toolStartedById = new Map<string, string>();

  for (const event of events.filter((item) => item.type === "tool_started")) {
    const payload = toPayloadShape(event.payload);
    const toolCallId = getToolCallId(payload.toolCall);

    if (toolCallId) {
      toolStartedById.set(toolCallId, event.id);
    }
  }

  return toolStartedById;
}

function createToolCauseEdgeForEvent(
  event: AgentEvent,
  toolStartedById: Map<string, string>
): RunGraphEdge[] {
  if (event.type !== "permission_checked" && event.type !== "tool_finished") {
    return [];
  }

  const edge = createToolCauseEdge(event, toolStartedById);

  return edge ? [edge] : [];
}

function createToolCauseEdge(
  event: AgentEvent,
  toolStartedById: Map<string, string>
): RunGraphEdge | undefined {
  const payload = toPayloadShape(event.payload);

  if (!payload.toolCallId) {
    return undefined;
  }

  const toolStartedId = toolStartedById.get(payload.toolCallId);

  if (!toolStartedId) {
    return undefined;
  }

  return {
    id: `caused_by.${toolStartedId}.${event.id}`,
    source: toolStartedId,
    target: event.id,
    kind: "caused_by",
  };
}

function createRunGraphMetrics(events: AgentEvent[]): RunGraphMetrics {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;

  for (const event of events) {
    const payload = toPayloadShape(event.payload);
    const providerEvent = toModelEvent(payload.event);

    if (event.type === "provider_usage" && providerEvent.usage) {
      totalInputTokens += providerEvent.usage.inputTokens;
      totalOutputTokens += providerEvent.usage.outputTokens;
      totalTokens += providerEvent.usage.totalTokens;
    }
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    contextBuildCount: events.filter((event) => event.type === "context_built")
      .length,
    modelRequestCount: events.filter(
      (event) => event.type === "model_request_started"
    ).length,
    toolCallCount: events.filter((event) => event.type === "tool_started")
      .length,
  };
}

function findMissingStop(graph: RunGraph): RunGraphDiagnostic[] {
  if (graph.nodes.some((node) => node.kind === "stop")) {
    return [];
  }

  return [
    {
      id: "diagnostic.missing_stop",
      code: "missing_stop",
      severity: "error",
      message: "Run graph has no stop event.",
    },
  ];
}

function findToolWithoutPermission(graph: RunGraph): RunGraphDiagnostic[] {
  const toolCallIds = new Map<string, string>();
  const permissionToolCallIds = new Set<string>();

  for (const node of graph.nodes) {
    const payload = toPayloadShape(node.payloadSummary);

    if (node.kind === "tool_call") {
      const toolCallId = getToolCallId(payload.toolCall);

      if (toolCallId) {
        toolCallIds.set(toolCallId, node.id);
      }
    }

    if (node.kind === "permission" && payload.toolCallId) {
      permissionToolCallIds.add(payload.toolCallId);
    }
  }

  return Array.from(toolCallIds.entries())
    .filter(([toolCallId]) => !permissionToolCallIds.has(toolCallId))
    .map(([toolCallId, nodeId]) => ({
      id: `diagnostic.tool_without_permission.${toolCallId}`,
      code: "tool_without_permission",
      severity: "error",
      message: `Tool call ${toolCallId} has no permission event.`,
      nodeId,
    }));
}

function findPermissionDeniedButExecuted(
  graph: RunGraph
): RunGraphDiagnostic[] {
  const deniedToolCallIds = new Map<string, string>();
  const resultByToolCallId = new Map<string, RunGraphToolResultShape>();

  for (const node of graph.nodes) {
    const payload = toPayloadShape(node.payloadSummary);

    if (node.kind === "permission" && payload.toolCallId) {
      const decision = toPermissionDecision(payload.decision);

      if (decision.decision && decision.decision !== "allow") {
        deniedToolCallIds.set(payload.toolCallId, node.id);
      }
    }

    if (node.kind === "tool_result" && payload.toolCallId) {
      resultByToolCallId.set(payload.toolCallId, toToolResult(payload.result));
    }
  }

  return Array.from(deniedToolCallIds.entries())
    .filter(([toolCallId]) => {
      const result = resultByToolCallId.get(toolCallId);
      return result && result.error?.code !== "permission_denied";
    })
    .map(([toolCallId, nodeId]) => ({
      id: `diagnostic.permission_denied_but_tool_executed.${toolCallId}`,
      code: "permission_denied_but_tool_executed",
      severity: "error",
      message: `Tool call ${toolCallId} was denied but did not finish as permission_denied.`,
      nodeId,
    }));
}

function findProviderMaxTokensWithoutStop(
  graph: RunGraph
): RunGraphDiagnostic[] {
  const maxTokenNode = graph.nodes.find((node) => {
    const payload = toPayloadShape(node.payloadSummary);
    const providerEvent = toModelEvent(payload.event);
    return (
      node.kind === "provider_event" &&
      providerEvent.stopReason === "max_tokens"
    );
  });

  if (!maxTokenNode || graph.stopReason === "provider_max_tokens") {
    return [];
  }

  return [
    {
      id: "diagnostic.provider_max_tokens_without_explicit_stop",
      code: "provider_max_tokens_without_explicit_stop",
      severity: "error",
      message:
        "Provider returned max_tokens without a provider_max_tokens stop.",
      nodeId: maxTokenNode.id,
    },
  ];
}

function findRepeatedToolCalls(graph: RunGraph): RunGraphDiagnostic[] {
  const counts = new Map<string, { count: number; nodeId: string }>();

  for (const node of graph.nodes) {
    const payload = toPayloadShape(node.payloadSummary);

    if (node.kind !== "tool_call") {
      continue;
    }

    const toolName = getToolCallName(payload.toolCall);
    const input = getToolCallInput(payload.toolCall);
    const key = `${toolName ?? "unknown"}:${JSON.stringify(input)}`;
    const current = counts.get(key);

    counts.set(key, {
      count: (current?.count ?? 0) + 1,
      nodeId: current?.nodeId ?? node.id,
    });
  }

  return Array.from(counts.entries())
    .filter(([, value]) => value.count >= 3)
    .map(([key, value]) => ({
      id: `diagnostic.repeated_tool_call.${key}`,
      code: "repeated_tool_call",
      severity: "warning",
      message: `Tool call pattern repeated ${value.count} times.`,
      nodeId: value.nodeId,
    }));
}

function findHighContextBudget(graph: RunGraph): RunGraphDiagnostic[] {
  return graph.nodes
    .filter((node) => {
      const tokenEstimate = node.metrics?.tokenEstimate;
      return (
        node.kind === "context_build" &&
        typeof tokenEstimate === "number" &&
        tokenEstimate >= CONTEXT_BUDGET_WARNING_TOKENS
      );
    })
    .map((node) => ({
      id: `diagnostic.context_budget_high.${node.id}`,
      code: "context_budget_high",
      severity: "warning",
      message: "Context token estimate is high.",
      nodeId: node.id,
    }));
}

function findUnlinkedEvents(graph: RunGraph): RunGraphDiagnostic[] {
  const linkedNodeIds = new Set<string>();

  for (const edge of graph.edges) {
    linkedNodeIds.add(edge.source);
    linkedNodeIds.add(edge.target);
  }

  if (graph.nodes.length <= 1) {
    return [];
  }

  return graph.nodes
    .filter((node) => !linkedNodeIds.has(node.id))
    .map((node) => ({
      id: `diagnostic.unlinked_event.${node.id}`,
      code: "unlinked_event",
      severity: "warning",
      message: "Run graph node is not linked to the main path.",
      nodeId: node.id,
    }));
}

function getRunGraphStop(events: AgentEvent[]): {
  stopReason?: LoopStopReason;
} {
  let stopEvent: AgentEvent | undefined;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (event?.type === "stop") {
      stopEvent = event;
      break;
    }
  }

  const payload = toPayloadShape(stopEvent?.payload);

  if (payload.stopReason) {
    return { stopReason: payload.stopReason };
  }

  return {};
}

function getRunGraphEnd(events: AgentEvent[]): { endedAt?: string } {
  const endedAt = events.at(-1)?.createdAt;

  if (endedAt) {
    return { endedAt };
  }

  return {};
}

function getIteration(event: AgentEvent): { iteration?: number } {
  const payload = toPayloadShape(event.payload);

  if (typeof payload.iteration === "number") {
    return { iteration: payload.iteration };
  }

  return {};
}

function getNodeMetrics(event: AgentEvent): {
  metrics?: {
    tokenEstimate?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
} {
  const payload = toPayloadShape(event.payload);
  const providerEvent = toModelEvent(payload.event);

  if (
    event.type === "context_built" &&
    typeof payload.tokenEstimate === "number"
  ) {
    return {
      metrics: {
        tokenEstimate: payload.tokenEstimate,
      },
    };
  }

  if (event.type === "provider_usage" && providerEvent.usage) {
    return {
      metrics: {
        inputTokens: providerEvent.usage.inputTokens,
        outputTokens: providerEvent.usage.outputTokens,
      },
    };
  }

  return {};
}

function summarizePayload(event: AgentEvent): RunGraphEventShape {
  const payload = toPayloadShape(event.payload);

  if (event.type === "provider_tool_call_done") {
    return summarizeProviderToolCallPayload(payload);
  }

  if (event.type.startsWith("provider_")) {
    return summarizeProviderPayload(payload);
  }

  return payload;
}

function summarizeProviderToolCallPayload(
  payload: RunGraphEventShape
): RunGraphEventShape {
  const providerEvent = toModelEvent(payload.event);

  return {
    ...getPayloadIteration(payload),
    event: {
      ...(providerEvent.type ? { type: providerEvent.type } : {}),
      ...(providerEvent.toolCall ? { toolCall: providerEvent.toolCall } : {}),
    },
  };
}

function summarizeProviderPayload(
  payload: RunGraphEventShape
): RunGraphEventShape {
  const providerEvent = toModelEvent(payload.event);

  return {
    ...getPayloadIteration(payload),
    event: {
      ...(providerEvent.type ? { type: providerEvent.type } : {}),
      ...(providerEvent.stopReason
        ? { stopReason: providerEvent.stopReason }
        : {}),
      ...(providerEvent.usage ? { usage: providerEvent.usage } : {}),
    },
  };
}

function getPayloadIteration(payload: RunGraphEventShape): {
  iteration?: number;
} {
  if (typeof payload.iteration === "number") {
    return { iteration: payload.iteration };
  }

  return {};
}

function toPayloadShape(payload: unknown): RunGraphEventShape {
  if (payload && typeof payload === "object") {
    return payload as RunGraphEventShape;
  }

  return {};
}

function toModelEvent(event: unknown): RunGraphModelEventShape {
  if (event && typeof event === "object") {
    return event as RunGraphModelEventShape;
  }

  return {};
}

function toPermissionDecision(
  decision: unknown
): RunGraphPermissionDecisionShape {
  if (decision && typeof decision === "object") {
    return decision as RunGraphPermissionDecisionShape;
  }

  return {};
}

function toToolResult(result: unknown): RunGraphToolResultShape {
  if (result && typeof result === "object") {
    return result as RunGraphToolResultShape;
  }

  return {};
}

function getToolCallId(toolCall: unknown): string | undefined {
  if (toolCall && typeof toolCall === "object" && "id" in toolCall) {
    const id = toolCall.id;
    return typeof id === "string" ? id : undefined;
  }

  return undefined;
}

function getToolCallName(toolCall: unknown): string | undefined {
  if (toolCall && typeof toolCall === "object" && "name" in toolCall) {
    const name = toolCall.name;
    return typeof name === "string" ? name : undefined;
  }

  return undefined;
}

function getToolCallInput(toolCall: unknown): unknown {
  if (toolCall && typeof toolCall === "object" && "input" in toolCall) {
    return toolCall.input;
  }

  return undefined;
}

function dedupeEdges(edges: RunGraphEdge[]): RunGraphEdge[] {
  return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}

function isErrorStopReason(stopReason: unknown): boolean {
  return (
    stopReason === "provider_error" ||
    stopReason === "tool_error" ||
    stopReason === "user_interrupted"
  );
}
