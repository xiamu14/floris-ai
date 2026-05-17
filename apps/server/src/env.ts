import type { ServerEnv } from "#/types/http.type";

const DEFAULT_PORT = 3100;
const DEFAULT_HOST = "127.0.0.1";

export function loadServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
	const port = Number.parseInt(env.PORT ?? "", 10);

	return {
		port: Number.isFinite(port) ? port : DEFAULT_PORT,
		host: env.HOST ?? DEFAULT_HOST,
		nodeEnv: env.NODE_ENV ?? "development",
	};
}
