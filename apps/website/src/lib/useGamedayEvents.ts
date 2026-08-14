import { useEffect, useRef } from 'react';
import type { GamedayEventType } from '@onog/shared';
import { subscribeToGamedayEvents } from './gamedayEvents';

/**
 * Handlers for the live-update channel, keyed by event type. Each key picks
 * events of that type off the shared connection, so new event types are
 * handled additively — just add a key. The payload is the JSON-parsed `data`
 * of the event.
 */
export type GamedayEventHandlers = Partial<Record<GamedayEventType, (payload: unknown) => void>>;

/**
 * Subscribe to a gameday's live-update channel — deliberately stateless.
 *
 * This ticket only keeps the connection open (see
 * docs/features/shared-foundation.md); it does not feed any UI yet, so this
 * hook never re-renders its caller. A ref holds the latest handlers so
 * changing them doesn't tear down and reopen the subscription — only a
 * change of `gamedayId` does that.
 *
 * Pass `null` as the id to keep the connection closed (e.g. while unknown).
 */
export function useGamedayEvents(
	gamedayId: string | null,
	handlers: GamedayEventHandlers,
): void {
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		if (!gamedayId) return;

		return subscribeToGamedayEvents(gamedayId, (type, payload) => {
			handlersRef.current[type]?.(payload);
		});
	}, [gamedayId]);
}
