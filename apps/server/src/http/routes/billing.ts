import { Hono } from "hono";
import { getCurrentSubscription } from "#/billing/billing-service";
import type { AppBindings } from "#/types/http.type";

export const billingRoute = new Hono<AppBindings>();

billingRoute.get("/subscription", (context) =>
	context.json({
		subscription: getCurrentSubscription(),
		requestId: context.get("requestId"),
	}),
);
