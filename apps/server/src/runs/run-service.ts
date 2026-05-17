import { createRuntimeRpcClient } from "#/runtime/runtime-rpc-client";
import { toServerSentEventFrame } from "#/runtime/stream-event-mapper";
import type {
	RunRecord,
	RunService,
	RunStartRequest,
	RunStore,
	ServerSentEventFrame,
} from "#/types/run.type";

export function createRunService(deps: { runStore: RunStore }): RunService {
	return {
		getRun(runId: string): RunRecord | undefined {
			return deps.runStore.get(runId);
		},
		startRun(input: RunStartRequest): AsyncIterable<ServerSentEventFrame> {
			return startRuntimeRun(input, deps.runStore);
		},
	};
}

async function* startRuntimeRun(
	input: RunStartRequest,
	runStore: RunStore,
): AsyncIterable<ServerSentEventFrame> {
	const runtime = createRuntimeRpcClient();
	const now = new Date().toISOString();
	const run: RunRecord = {
		id: input.runId ?? crypto.randomUUID(),
		threadId: input.threadId ?? "local-thread",
		branchId: input.branchId ?? "main",
		status: "running",
		createdAt: now,
		updatedAt: now,
	};

	runStore.save(run);

	for await (const event of runtime.startRun({ ...input, runId: run.id })) {
		if (event.type === "run.completed") {
			runStore.save({
				...run,
				status: "completed",
				updatedAt: new Date().toISOString(),
			});
		}

		if (event.type === "run.failed") {
			runStore.save({
				...run,
				status: "failed",
				updatedAt: new Date().toISOString(),
			});
		}

		yield toServerSentEventFrame(event);
	}
}
