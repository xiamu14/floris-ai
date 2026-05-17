import type {
	RuntimeStreamEvent,
	ServerSentEventFrame,
} from "#/types/run.type";

export function toServerSentEventFrame(
	event: RuntimeStreamEvent,
): ServerSentEventFrame {
	return {
		id: event.id,
		event: event.type,
		data: event,
	};
}
