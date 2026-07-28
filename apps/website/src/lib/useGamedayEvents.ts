import { useEffect, useRef, useState } from 'react';
import type { GamedayEventType } from '@onog/shared';
import { logger } from '@onog/shared';

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

/**
 * Handlers for the live-update channel, keyed by event type. Each key becomes a
 * native SSE listener, so new event types are handled additively — just add a
 * key. The payload is the JSON-parsed `data` of the event.
 */
export type GamedayEventHandlers = Partial<
	Record<GamedayEventType, (payload: unknown) => void>
>;

const MAX_RECONNECT_DELAY_MS = 15_000;

/**
 * Subscribe to a gameday's Server-Sent-Events stream.
 *
 * - Opens one `EventSource` per gameday and registers a native listener per
 *   handled event type — replaces polling entirely.
 * - Reconnects automatically with capped exponential backoff when the
 *   connection drops.
 *
 * Pass `null` as the id to keep the connection closed (e.g. while unknown).
 */
export function useGamedayEvents(
	gamedayId: string | null,
	handlers: GamedayEventHandlers,
): ConnectionStatus {
	const [status, setStatus] = useState<ConnectionStatus>('closed');

	// Keep the latest handlers without re-opening the connection on every render.
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		if (!gamedayId) {
			setStatus('closed');
			return;
		}

		const types = Object.keys(handlersRef.current) as GamedayEventType[];
		let source: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let attempts = 0;
		let disposed = false;

		const connect = () => {
			setStatus('connecting');
			source = new EventSource(`/api/gamedays/${gamedayId}/events`, {
				withCredentials: true,
			});

			source.onopen = () => {
				attempts = 0;
				setStatus('open');
			};

			source.onerror = () => {
				source?.close();
				source = null;
				if (disposed) return;
				setStatus('connecting');
				const delay = Math.min(1000 * 2 ** attempts, MAX_RECONNECT_DELAY_MS);
				attempts += 1;
				reconnectTimer = setTimeout(connect, delay);
			};

			for (const type of types) {
				source.addEventListener(type, (event) => {
					let payload: unknown;
					try {
						payload = JSON.parse((event as MessageEvent).data);
					} catch {
						logger.error(`Failed to parse gameday event payload for type "${type}"`, event);
						return;
					}
					handlersRef.current[type]?.(payload);
				});
			}
		};

		connect();

		return () => {
			disposed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			source?.close();
			setStatus('closed');
		};
	}, [gamedayId]);

	return status;
}
