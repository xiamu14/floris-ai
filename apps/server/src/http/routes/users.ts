import { Hono } from "hono";
import type { AppBindings } from "#/types/http.type";
import { getCurrentUser } from "#/users/user-service";

export const usersRoute = new Hono<AppBindings>();

usersRoute.get("/me", (context) =>
	context.json({
		user: getCurrentUser(),
		requestId: context.get("requestId"),
	}),
);
