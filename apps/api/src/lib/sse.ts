import type { SSEStreamingApi } from 'hono/streaming';
import type { GamedayEvent } from '@onog/shared';
import { subscribe } from './events';

// How often to send an SSE comment heartbeat so proxies/browsers keep the
// connection open and a dropped connection is detected promptly.
const HEARTBEAT_MS = 25_000;

// A single shared heartbeat drives every open stream — one interval total, not
// one per client. The timer only exists while at least one stream is connected.
const activeStreams = new Set<SSEStreamingApi>();
let heartbeat: ReturnType<typeof setInterval> | null = null;

function addToHeartbeat(stream: SSEStreamingApi): void {
	activeStreams.add(stream);
	heartbeat ??= setInterval(() => {
		for (const s of activeStreams) {
			// SSE comment line — ignored by EventSource, keeps the socket warm.
			// A single broken stream must not stop pings to the others.
			try {
				s.write(': ping\n\n').catch(() => {});
			} catch {
				/* cleaned up by its own abort handler */
			}
		}
	}, HEARTBEAT_MS);
}

function removeFromHeartbeat(stream: SSEStreamingApi): void {
	activeStreams.delete(stream);
	if (activeStreams.size === 0 && heartbeat) {
		clearInterval(heartbeat);
		heartbeat = null;
	}
}

/**
 * Drive one SSE connection for a gameday's live-update channel.
 *
 * Bridges the pure pub/sub hub (`events.ts`) to a Hono SSE stream: subscribes
 * the stream, keeps it warm via the shared heartbeat, serializes events as
 * native SSE frames (`event:` = type, `data:` = JSON payload) and tears
 * everything down on disconnect. All SSE/transport concerns live here so the
 * hub stays transport-agnostic and the route handler stays a one-liner.
 *
 * Resolves once the client disconnects — keep it awaited inside `streamSSE` so
 * the stream stays open until then.
 */
export async function openGamedayStream(
	stream: SSEStreamingApi,
	gamedayId: string,
): Promise<void> {
	// `.catch` swallows writes that race with a disconnect (stream already closed).
	const send = (event: GamedayEvent) =>
		stream
			.writeSSE({ event: event.type, data: JSON.stringify(event.payload) })
			.catch(() => {});

	const unsubscribe = subscribe(gamedayId, { send });
	addToHeartbeat(stream);

	const cleanup = () => {
		removeFromHeartbeat(stream);
		unsubscribe();
	};
	stream.onAbort(cleanup);

	send({ type: 'connected', payload: { gamedayId } });

	// Stay pending until the client disconnects, otherwise the stream would
	// close right after the first write.
	await new Promise<void>((resolve) => stream.onAbort(resolve));
	cleanup();
}
