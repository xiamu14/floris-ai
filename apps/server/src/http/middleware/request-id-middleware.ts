import { createMiddleware } from "hono/factory";
import type { AppBindings } from "#/types/http.type";

export const requestIdMiddleware = createMiddleware<AppBindings>(
	async (context, next) => {
		const requestId = context.req.header("x-request-id") ?? crypto.randomUUID();

		context.set("requestId", requestId);
		context.header("x-request-id", requestId);

		await next();
	},
);
