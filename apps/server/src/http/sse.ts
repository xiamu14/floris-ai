import { streamSSE } from "hono/streaming";
import type { AppContext } from "#/types/http.type";
import type { ServerSentEventFrame } from "#/types/run.type";

export function createSseResponse(
	context: AppContext,
	frames: AsyncIterable<ServerSentEventFrame>,
) {
	return streamSSE(context, async (stream) => {
		for await (const frame of frames) {
			const message = {
				data: JSON.stringify(frame.data),
				event: frame.event,
				...(frame.id ? { id: frame.id } : {}),
			};

			await stream.writeSSE(message);
		}
	});
}
