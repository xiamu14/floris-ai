import { Hono } from "hono";
import { createSseResponse } from "#/http/sse";
import type { AppBindings } from "#/types/http.type";
import type { RunService, RunStartRequest } from "#/types/run.type";

export function createRunsRoute(runService: RunService) {
	const runsRoute = new Hono<AppBindings>();

	runsRoute.post("/", async (context) => {
		const input = await context.req.json<RunStartRequest>();
		const stream = runService.startRun(input);

		return createSseResponse(context, stream);
	});

	return runsRoute;
}
