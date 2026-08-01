import { useEffect, useRef, useState } from 'react';
import type { GamedayEventType } from '@onog/shared';
import { subscribeToGamedayStream, type ConnectionStatus } from './gamedayStream';

export type { ConnectionStatus };

/**
 * Handlers for the live-update channel, keyed by event type. Each key picks
 * events of that type off the shared stream, so new event types are handled
 * additively — just add a key. The payload is the JSON-parsed `data` of the
 * event.
 */
export type GamedayEventHandlers = Partial<
	Record<GamedayEventType, (payload: unknown) => void>
>;

/**
 * Subscribe to a gameday's Server-Sent-Events stream.
 *
 * Pass `null` as the id to keep the connection closed (e.g. while unknown).
 */
export function useGamedayEvents(
	gamedayId: string | null,
	handlers: GamedayEventHandlers,
): ConnectionStatus {
	const [status, setStatus] = useState<ConnectionStatus>('closed');

	// Keep the latest handlers without re-subscribing on every render.
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		if (!gamedayId) {
			setStatus('closed');
			return;
		}

		return subscribeToGamedayStream(gamedayId, {
			onEvent: (type, payload) => handlersRef.current[type]?.(payload),
			onStatus: setStatus,
		});
	}, [gamedayId]);

	return status;
}
