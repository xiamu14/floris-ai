import { spawn } from "node:child_process";
import { resolve } from "node:path";

export function startRuntimeProcess() {
	const cwd =
		process.env.FLORIS_AGENT_RUNTIME_CWD ??
		resolve(process.cwd(), "../../packages/agent-runtime");

	return spawn("bun", ["run", "rpc"], {
		cwd,
		stdio: ["pipe", "pipe", "pipe"],
	});
}
