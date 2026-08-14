import { GAMEDAY_EVENT_TYPES, logger } from '@onog/shared';
import type { GamedayEventType } from '@onog/shared';

/**
 * A single module-scoped `EventSource` shared across every subscriber — never
 * one connection per component/hook call, since browsers cap concurrent
 * HTTP/1.1 connections per origin and a live view can mount several
 * consumers of the same gameday.
 *
 * `EventSource` is only ever constructed inside `subscribeToGamedayEvents`
 * (which runs from an effect), never at module-evaluation time — this module
 * is imported during SSR, where `EventSource` does not exist.
 */

export type GamedayEventListener = (type: GamedayEventType, payload: unknown) => void;

// Cap the delay before reopening a connection that errored while already
// closed (e.g. a rejected handshake) — `EventSource` retries transient
// network blips on its own, this guard only covers a connection left dead.
const REOPEN_DELAY_MS = 3_000;

let source: EventSource | null = null;
let openGamedayId: string | null = null;
let reopenTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<GamedayEventListener>();

function openConnection(gamedayId: string): void {
	openGamedayId = gamedayId;
	const es = new EventSource(`/api/gamedays/${gamedayId}/events`);
	source = es;

	// One listener per event type, registered once for the whole connection —
	// fan-out to every subscriber, which filters for the types it cares about.
	for (const type of GAMEDAY_EVENT_TYPES) {
		es.addEventListener(type, (event) => {
			let payload: unknown;
			try {
				payload = JSON.parse((event as MessageEvent).data);
			} catch {
				logger.error(`Failed to parse gameday event payload for type "${type}"`, event);
				return;
			}
			for (const listener of subscribers) listener(type, payload);
		});
	}

	es.onerror = () => {
		// `EventSource` already retries transient blips itself; only a
		// connection left CLOSED (e.g. a rejected handshake) needs our help.
		if (es.readyState !== EventSource.CLOSED || reopenTimer) return;
		reopenTimer = setTimeout(() => {
			reopenTimer = null;
			if (source === es && openGamedayId === gamedayId && subscribers.size > 0) {
				openConnection(gamedayId);
			}
		}, REOPEN_DELAY_MS);
	};
}

function closeConnection(): void {
	if (reopenTimer) {
		clearTimeout(reopenTimer);
		reopenTimer = null;
	}
	source?.close();
	source = null;
	openGamedayId = null;
}

/**
 * Subscribe to the shared live-update channel for a gameday.
 *
 * The first subscriber opens the connection, the last one closes it. Asking
 * for a different gameday id than the one currently open swaps the
 * connection. Returns an unsubscribe function.
 */
export function subscribeToGamedayEvents(
	gamedayId: string,
	onEvent: GamedayEventListener,
): () => void {
	if (openGamedayId !== gamedayId) {
		closeConnection();
		openConnection(gamedayId);
	}
	subscribers.add(onEvent);

	return () => {
		subscribers.delete(onEvent);
		if (subscribers.size === 0) closeConnection();
	};
}
