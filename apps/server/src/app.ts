import { Hono } from "hono";
import { errorMiddleware } from "#/http/middleware/error-middleware";
import { requestIdMiddleware } from "#/http/middleware/request-id-middleware";
import { billingRoute } from "#/http/routes/billing";
import { createDebugRunsRoute } from "#/http/routes/debug-runs";
import { createRunsRoute } from "#/http/routes/runs";
import { usersRoute } from "#/http/routes/users";
import { createRunService } from "#/runs/run-service";
import { createInMemoryRunStore } from "#/runs/run-store";
import type { AppBindings } from "#/types/http.type";

export function createApp() {
	const app = new Hono<AppBindings>();
	const runService = createRunService({
		runStore: createInMemoryRunStore(),
	});

	app.use("*", requestIdMiddleware);
	app.onError(errorMiddleware);

	app.get("/health", (context) =>
		context.json({
			ok: true,
			requestId: context.get("requestId"),
		}),
	);

	app.route("/runs", createRunsRoute(runService));
	app.route("/debug/runs", createDebugRunsRoute(runService));
	app.route("/users", usersRoute);
	app.route("/billing", billingRoute);

	return app;
}
