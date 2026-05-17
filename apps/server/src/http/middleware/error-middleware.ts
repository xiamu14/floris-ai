import type { ErrorHandler } from "hono";
import type { AppBindings, ErrorResponseBody } from "#/types/http.type";

export const errorMiddleware: ErrorHandler<AppBindings> = (error, context) => {
	const requestId = context.get("requestId");
	const body: ErrorResponseBody = {
		error: {
			code: "internal_error",
			message: error.message || "Unexpected server error",
			requestId,
		},
	};

	return context.json(body, 500);
};
