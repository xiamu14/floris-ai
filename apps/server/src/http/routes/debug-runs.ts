import { Hono } from "hono";
import type { AppBindings } from "#/types/http.type";
import type { RunService } from "#/types/run.type";

export function createDebugRunsRoute(runService: RunService) {
	const debugRunsRoute = new Hono<AppBindings>();

	debugRunsRoute.get("/:runId", (context) => {
		const run = runService.getRun(context.req.param("runId"));

		if (!run) {
			return context.json(
				{
					error: {
						code: "run_not_found",
						message: "Run was not found",
						requestId: context.get("requestId"),
					},
				},
				404,
			);
		}

		return context.json({ run });
	});

	return debugRunsRoute;
}
