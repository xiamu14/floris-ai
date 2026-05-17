import type { Context } from "hono";

export interface ServerEnv {
	port: number;
	host: string;
	nodeEnv: string;
}

export interface RequestVariables {
	requestId: string;
}

export interface AppBindings {
	Variables: RequestVariables;
}

export interface ErrorResponseBody {
	error: {
		code: string;
		message: string;
		requestId?: string;
	};
}

export type AppContext = Context<AppBindings>;
