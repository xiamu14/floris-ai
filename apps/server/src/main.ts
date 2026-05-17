import { createApp } from "#/app";
import { loadServerEnv } from "#/env";

const env = loadServerEnv();
const app = createApp();
const server = Bun.serve({
	fetch: app.fetch,
	hostname: env.host,
	port: env.port,
});

console.log(`Floris server listening on ${server.url}`);
