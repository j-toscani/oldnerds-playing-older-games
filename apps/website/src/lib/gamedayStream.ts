import { GAMEDAY_EVENT_TYPES, logger } from '@onog/shared';
import type { GamedayEventType } from '@onog/shared';

/**
 * Shared `EventSource` registry for the per-gameday live channel.
 *
 * One connection per gameday, no matter how many components listen — the
 * client-side mirror of the server's pub/sub hub in `apps/api/src/lib/events.ts`
 * (rooms keyed by gameday id, pruned when the last subscriber leaves). Without
 * this, every component calling `useGamedayEvents` would open its own stream:
 * each one occupies a connection for as long as it lives, and browsers cap
 * concurrent HTTP/1.1 connections per origin at around six, so a handful of live
 * components would start starving ordinary requests.
 *
 * `EventSource` is only ever touched inside `createConnection`, which runs from
 * a subscriber's effect — never at import time, so this module is SSR-safe.
 */

/**
 * `failed` means the connection gave up reconnecting. `EventSource` never
 * exposes the HTTP status of a rejected handshake, so a 401 from the JWT
 * middleware looks exactly like a network blip — callers have to source that
 * distinction elsewhere (a snapshot fetch does see the status code).
 */
export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'failed';

export type StreamSubscriber = {
	/** Called for every event of every type; subscribers filter for what they need. */
	onEvent: (type: GamedayEventType, payload: unknown) => void;
	onStatus: (status: ConnectionStatus) => void;
};

const MAX_RECONNECT_DELAY_MS = 15_000;

// Cap the retries: a connection the server always rejects (not logged in, gameday
// gone) is indistinguishable from a transient failure here, so retrying forever
// would hammer a route that never lets us through. The counter resets on every
// successful open, so a long-lived stream keeps its full retry budget.
const MAX_RECONNECT_ATTEMPTS = 5;

// Keep a connection alive briefly after its last subscriber leaves. Navigating
// between two views of the same gameday then reuses the open stream instead of
// tearing it down and immediately reconnecting — which also covers the
// double-invoked effects of StrictMode in development.
const LINGER_MS = 5_000;

type Connection = {
	source: EventSource | null;
	status: ConnectionStatus;
	subscribers: Set<StreamSubscriber>;
	attempts: number;
	reconnectTimer: ReturnType<typeof setTimeout> | null;
	lingerTimer: ReturnType<typeof setTimeout> | null;
	connect: () => void;
	teardown: () => void;
};

const connections = new Map<string, Connection>();

function createConnection(gamedayId: string): Connection {
	const connection: Connection = {
		source: null,
		status: 'closed',
		subscribers: new Set(),
		attempts: 0,
		reconnectTimer: null,
		lingerTimer: null,
		connect: () => {},
		teardown: () => {},
	};

	const setStatus = (status: ConnectionStatus) => {
		if (connection.status === status) return;
		connection.status = status;
		for (const subscriber of connection.subscribers) {
			subscriber.onStatus(status);
		}
	};

	connection.connect = () => {
		setStatus('connecting');
		const source = new EventSource(`/api/gamedays/${gamedayId}/events`, {
			withCredentials: true,
		});
		connection.source = source;

		source.onopen = () => {
			connection.attempts = 0;
			setStatus('open');
		};

		source.onerror = () => {
			source.close();
			connection.source = null;
			// Nothing to reconnect for: either the entry is gone, or it is only
			// waiting out its linger window and the timer will clean it up.
			if (!connections.has(gamedayId) || connection.subscribers.size === 0) return;
			if (connection.attempts >= MAX_RECONNECT_ATTEMPTS) {
				setStatus('failed');
				return;
			}
			setStatus('connecting');
			const delay = Math.min(1000 * 2 ** connection.attempts, MAX_RECONNECT_DELAY_MS);
			connection.attempts += 1;
			connection.reconnectTimer = setTimeout(connection.connect, delay);
		};

		// One listener per event type, registered once for the whole connection —
		// fan-out to the subscribers, which filter by the types they handle. Because
		// this covers every known type, a subscriber can start handling a new type
		// without the connection having to be rebuilt.
		for (const type of GAMEDAY_EVENT_TYPES) {
			source.addEventListener(type, (event) => {
				let payload: unknown;
				try {
					payload = JSON.parse((event as MessageEvent).data);
				} catch {
					logger.error(`Failed to parse gameday event payload for type "${type}"`, event);
					return;
				}
				for (const subscriber of connection.subscribers) {
					subscriber.onEvent(type, payload);
				}
			});
		}
	};

	connection.teardown = () => {
		if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer);
		if (connection.lingerTimer) clearTimeout(connection.lingerTimer);
		connection.reconnectTimer = null;
		connection.lingerTimer = null;
		connection.source?.close();
		connection.source = null;
		connection.status = 'closed';
	};

	return connection;
}

/**
 * Attach a subscriber to a gameday's live channel, opening the stream if this is
 * the first one. Returns an unsubscribe function; the connection closes once the
 * last subscriber has left and the linger window has passed.
 */
export function subscribeToGamedayStream(
	gamedayId: string,
	subscriber: StreamSubscriber,
): () => void {
	let connection = connections.get(gamedayId);

	if (connection) {
		// Reclaim a connection that was waiting out its linger window.
		if (connection.lingerTimer) {
			clearTimeout(connection.lingerTimer);
			connection.lingerTimer = null;
		}
	} else {
		connection = createConnection(gamedayId);
		connections.set(gamedayId, connection);
	}

	const target = connection;
	target.subscribers.add(subscriber);

	// Hand out the current status right away, so a subscriber joining an already
	// open stream doesn't sit on the default 'closed' until the next change.
	subscriber.onStatus(target.status);

	if (!target.source && !target.reconnectTimer) {
		// A fresh subscriber is a deliberate reason to try again after we gave up,
		// so hand it a full retry budget instead of one doomed attempt.
		if (target.status === 'failed') target.attempts = 0;
		target.connect();
	}

	return () => {
		target.subscribers.delete(subscriber);
		if (target.subscribers.size > 0 || target.lingerTimer) return;

		target.lingerTimer = setTimeout(() => {
			target.lingerTimer = null;
			connections.delete(gamedayId);
			target.teardown();
		}, LINGER_MS);
	};
}
