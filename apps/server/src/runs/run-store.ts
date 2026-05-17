import type { RunRecord, RunStore } from "#/types/run.type";

export function createInMemoryRunStore(): RunStore {
	const runs = new Map<string, RunRecord>();

	return {
		save(run: RunRecord): void {
			runs.set(run.id, run);
		},
		get(runId: string): RunRecord | undefined {
			return runs.get(runId);
		},
	};
}
