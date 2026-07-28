import type { GamedayEvent } from '@onog/shared';

/**
 * In-memory pub/sub hub for the per-gameday live-update channel (SSE).
 *
 * MVP: single-instance assumption — clients are held in process memory and
 * there is no cross-instance fan-out. Horizontal scaling is intentionally
 * out of scope (see docs/features/shared-foundation.md).
 */

export type EventClient = {
	/** Deliver a single envelope to this subscriber. */
	send: (event: GamedayEvent) => void;
};

const rooms = new Map<string, Set<EventClient>>();

/**
 * Register a client for a gameday's event stream.
 * Returns an unsubscribe function that removes the client and prunes empty rooms.
 */
export function subscribe(gamedayId: string, client: EventClient): () => void {
	let room = rooms.get(gamedayId);
	if (!room) {
		room = new Set();
		rooms.set(gamedayId, room);
	}
	room.add(client);

	return () => {
		const current = rooms.get(gamedayId);
		if (!current) return;
		current.delete(client);
		if (current.size === 0) rooms.delete(gamedayId);
	};
}

/**
 * Push an envelope to every client currently subscribed to a gameday.
 * A failing client must not break delivery to the others.
 */
export function broadcast(gamedayId: string, event: GamedayEvent): void {
	const room = rooms.get(gamedayId);
	if (!room) return;
	for (const client of room) {
		try {
			client.send(event);
		} catch {
			// A broken stream will be cleaned up by its own abort handler.
		}
	}
}
