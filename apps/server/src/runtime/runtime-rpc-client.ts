import { createInterface } from "node:readline";
import { startRuntimeProcess } from "#/runtime/runtime-process";
import type {
	RunStartRequest,
	RuntimeCommandEnvelope,
	RuntimeRpcOutputEnvelope,
	RuntimeStreamEvent,
} from "#/types/run.type";

export function createRuntimeRpcClient() {
	return {
		startRun(input: RunStartRequest): AsyncIterable<RuntimeStreamEvent> {
			return startRuntimeRun(input);
		},
	};
}

async function* startRuntimeRun(
	input: RunStartRequest,
): AsyncIterable<RuntimeStreamEvent> {
	const runtime = startRuntimeProcess();
	const command = createRunStartCommand(input);

	runtime.stdin.write(`${JSON.stringify(command)}\n`);

	try {
		for await (const value of readRuntimeOutput(runtime.stdout)) {
			if (value.type === "command.failed") {
				yield createFailureEvent(command, value);
				break;
			}

			if (value.type !== "stream.event" || !value.event) {
				continue;
			}

			yield value.event;

			if (
				value.event.type === "run.completed" ||
				value.event.type === "run.failed"
			) {
				break;
			}
		}
	} finally {
		runtime.kill();
	}
}

async function* readRuntimeOutput(output: NodeJS.ReadableStream) {
	const lines = createInterface({
		input: output,
		crlfDelay: Number.POSITIVE_INFINITY,
	});

	for await (const line of lines) {
		const trimmed = line.trim();

		if (!trimmed) {
			continue;
		}

		yield JSON.parse(trimmed) as RuntimeRpcOutputEnvelope;
	}
}

function createRunStartCommand(input: RunStartRequest): RuntimeCommandEnvelope {
	return {
		id: crypto.randomUUID(),
		type: "run.start",
		createdAt: new Date().toISOString(),
		payload: {
			runId: input.runId ?? crypto.randomUUID(),
			threadId: input.threadId,
			branchId: input.branchId,
			workspacePath: input.workspacePath,
			message: input.message,
			providerMode: "scripted",
		},
	};
}

function createFailureEvent(
	command: RuntimeCommandEnvelope,
	output: RuntimeRpcOutputEnvelope,
): RuntimeStreamEvent {
	return {
		id: crypto.randomUUID(),
		type: "run.failed",
		runId: output.runId ?? command.id,
		createdAt: new Date().toISOString(),
		payload: {
			code: output.error?.code ?? "runtime_command_failed",
			message: output.error?.message ?? "Runtime command failed.",
		},
	};
}
