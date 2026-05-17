export interface RunStartRequest {
	runId?: string;
	message: string;
	threadId?: string;
	branchId?: string;
	workspacePath?: string;
}

export interface RunRecord {
	id: string;
	threadId: string;
	branchId: string;
	status: RunStatus;
	createdAt: string;
	updatedAt: string;
}

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface RunStore {
	save(run: RunRecord): void;
	get(runId: string): RunRecord | undefined;
}

export interface RunService {
	getRun(runId: string): RunRecord | undefined;
	startRun(input: RunStartRequest): AsyncIterable<ServerSentEventFrame>;
}

export interface RuntimeCommandEnvelope {
	id: string;
	type: "run.start" | "run.abort";
	createdAt: string;
	payload?: unknown;
}

export interface RuntimeStreamEvent {
	id: string;
	type: string;
	runId: string;
	threadId?: string;
	branchId?: string;
	createdAt: string;
	payload?: unknown;
}

export interface RuntimeRpcOutputEnvelope {
	id: string;
	type: "command.accepted" | "command.failed" | "stream.event";
	runId?: string;
	commandId?: string;
	createdAt: string;
	event?: RuntimeStreamEvent;
	error?: {
		code: string;
		message: string;
	};
}

export interface ServerSentEventFrame {
	event: string;
	data: unknown;
	id?: string;
}
