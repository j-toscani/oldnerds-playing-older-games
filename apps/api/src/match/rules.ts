import type {
	MatchData,
	MatchEvent,
	MatchFormat,
	MatchParticipant,
	MatchState,
} from '@onog/shared';
import type { MatchEventWrite } from '../models/match';

/** A match without activity for this long is aborted (open) or frozen (finished) */
export const MATCH_TIMEOUT_MS = 24 * 60 * 60 * 1000;

const MAPS_TO_PLAY: Record<MatchFormat, number> = { bo3: 3, bo5: 5, bo7: 7 };

export type MatchAction =
	| { type: 'veto'; map: string }
	| { type: 'pick'; map: string }
	| { type: 'result'; winnerId: string }
	| { type: 'undo' }
	| { type: 'abort' };

export type MatchActionError =
	/** The actor may not do this at all */
	| 'forbidden'
	/** The actor may veto/pick, but it's the other player's turn */
	| 'not_your_turn'
	/** The action doesn't fit the current phase or map */
	| 'invalid'
	/** The match is aborted, or finished and the action isn't an undo */
	| 'closed'
	/** 24 hours without activity have passed */
	| 'expired';

export type ActionPlan =
	| { ok: true; write: MatchEventWrite; next: MatchState }
	| { ok: false; error: MatchActionError };

type Match = Pick<
	MatchData,
	| 'id'
	| 'participants'
	| 'format'
	| 'mapPool'
	| 'vetoStarterId'
	| 'status'
	| 'version'
	| 'updatedAt'
>;

export function getPlayers(match: Pick<Match, 'participants'>): [MatchParticipant, MatchParticipant] {
	const players = match.participants.filter((p) => p.role === 'player');
	if (players.length !== 2) throw new Error(`Match has ${players.length} players instead of 2`);
	return [players[0], players[1]];
}

export function getOrganizer(match: Pick<Match, 'participants'>): MatchParticipant {
	const organizer = match.participants.find((p) => p.role === 'organizer');
	if (!organizer) throw new Error('Match has no organizer');
	return organizer;
}

export function isOrganizerPlaying(match: Pick<Match, 'participants'>): boolean {
	const organizer = getOrganizer(match);
	return getPlayers(match).some((p) => p.discordId === organizer.discordId);
}

export function getOpponentId(match: Pick<Match, 'participants'>, playerId: string): string {
	const [a, b] = getPlayers(match);
	return a.discordId === playerId ? b.discordId : a.discordId;
}

export function isExpired(match: Pick<Match, 'updatedAt'>, now: Date): boolean {
	return now.getTime() - new Date(match.updatedAt).getTime() > MATCH_TIMEOUT_MS;
}

/** How many maps are vetoed so that exactly the maps for the format remain */
export function vetoCount(match: Pick<Match, 'format' | 'mapPool'>): number {
	return Math.max(0, match.mapPool.length - MAPS_TO_PLAY[match.format]);
}

function activeEvents(events: MatchEvent[]): MatchEvent[] {
	return events.filter((e) => e.undoneAt === null).sort((a, b) => a.seq - b.seq);
}

/** Derives the current state from the match and its events; undone events are ignored */
export function deriveMatchState(match: Match, events: MatchEvent[], now: Date): MatchState {
	const players = getPlayers(match);
	const active = activeEvents(events);
	const winsNeeded = (MAPS_TO_PLAY[match.format] + 1) / 2;

	const vetoes = active
		.filter((e) => e.type === 'veto')
		.map((e) => ({ map: e.map!, playerId: e.playerId! }));
	const remainingMaps = match.mapPool.filter((map) => !vetoes.some((v) => v.map === map));

	const order: MatchState['order'] = active
		.filter((e) => e.type === 'pick')
		.map((e) => ({ map: e.map!, pickedById: e.playerId! }));
	const picksDone = order.length;
	const unpicked = remainingMaps.filter((map) => !order.some((o) => o.map === map));
	// The last map needs no decision, so it is never stored as an event
	if (vetoes.length >= vetoCount(match) && unpicked.length === 1) {
		order.push({ map: unpicked[0], pickedById: null });
	}

	const results = active.filter((e) => e.type === 'result');
	const wins: Record<string, number> = Object.fromEntries(players.map((p) => [p.discordId, 0]));
	for (const result of results) wins[result.playerId!] += 1;
	const winnerId = players.find((p) => wins[p.discordId] >= winsNeeded)?.discordId ?? null;

	let phase: MatchState['phase'];
	// A stored `aborted` without an abort event comes from the 24-hour timeout
	if (active.some((e) => e.type === 'abort') || match.status === 'aborted') phase = 'aborted';
	else if (vetoes.length < vetoCount(match)) phase = 'veto';
	else if (order.length < remainingMaps.length) phase = 'pick';
	else if (winnerId) phase = 'finished';
	else phase = 'playing';

	if (phase !== 'finished' && isExpired(match, now)) phase = 'aborted';

	const otherStarterId = getOpponentId(match, match.vetoStarterId);
	let turnId: string | null = null;
	if (phase === 'veto') {
		turnId = vetoes.length % 2 === 0 ? match.vetoStarterId : otherStarterId;
	} else if (phase === 'pick') {
		// Whoever didn't start the veto picks first
		turnId = picksDone % 2 === 0 ? otherStarterId : match.vetoStarterId;
	}

	const orderComplete = order.length === remainingMaps.length;
	const games = orderComplete
		? order.map((o, i) => ({ map: o.map, winnerId: results[i]?.playerId ?? null }))
		: [];

	return {
		matchId: match.id,
		version: match.version,
		format: match.format,
		phase,
		players,
		organizer: getOrganizer(match),
		mapPool: match.mapPool,
		vetoes,
		remainingMaps,
		order,
		turnId,
		games,
		currentMap: phase === 'playing' ? (games[results.length]?.map ?? null) : null,
		wins,
		winsNeeded,
		winnerId,
	};
}

/**
 * Checks whether `actorId` may perform `action` and, if so, returns the event
 * to write and the state after it. Pure: the caller does the writing.
 */
export function planAction(
	match: Match,
	events: MatchEvent[],
	actorId: string,
	action: MatchAction,
	now: Date,
): ActionPlan {
	const state = deriveMatchState(match, events, now);
	const organizerId = state.organizer.discordId;
	const isOrganizer = actorId === organizerId;
	const isPlayer = state.players.some((p) => p.discordId === actorId);
	// Only an organizer who doesn't play may act for others
	const actsForOthers = isOrganizer && !isOrganizerPlaying(match);
	const fail = (error: MatchActionError): ActionPlan => ({ ok: false, error });

	if (!isPlayer && !isOrganizer) return fail('forbidden');

	if (state.phase === 'aborted') {
		const abortedByOrganizer = activeEvents(events).some((e) => e.type === 'abort');
		return fail(abortedByOrganizer ? 'closed' : 'expired');
	}
	if (state.phase === 'finished') {
		if (action.type !== 'undo') return fail('closed');
		if (isExpired(match, now)) return fail('expired');
	}

	let write: MatchEventWrite;
	switch (action.type) {
		case 'veto':
		case 'pick': {
			if (state.phase !== action.type) return fail('invalid');
			const available =
				action.type === 'veto'
					? state.remainingMaps
					: state.remainingMaps.filter((map) => !state.order.some((o) => o.map === map));
			if (!available.includes(action.map)) return fail('invalid');
			if (actorId !== state.turnId && !actsForOthers) {
				return fail(isPlayer ? 'not_your_turn' : 'forbidden');
			}
			write = {
				kind: 'create',
				event: { type: action.type, map: action.map, playerId: state.turnId, actorId },
			};
			break;
		}
		case 'result': {
			if (state.phase !== 'playing') return fail('invalid');
			if (!state.players.some((p) => p.discordId === action.winnerId)) return fail('invalid');
			write = {
				kind: 'create',
				event: { type: 'result', map: state.currentMap, playerId: action.winnerId, actorId },
			};
			break;
		}
		case 'undo': {
			const last = activeEvents(events).at(-1);
			if (!last) return fail('invalid');
			const allowed =
				state.phase === 'finished' ? isOrganizer : actsForOthers || last.actorId === actorId;
			if (!allowed) return fail('forbidden');
			write = { kind: 'undo', eventId: last.id, actorId };
			break;
		}
		case 'abort': {
			if (!isOrganizer) return fail('forbidden');
			write = { kind: 'create', event: { type: 'abort', map: null, playerId: null, actorId } };
			break;
		}
	}

	const nextEvents = applyWrite(events, write, match.version + 1, now);
	const next = deriveMatchState(
		{ ...match, version: match.version + 1, updatedAt: now.toISOString() },
		nextEvents,
		now,
	);
	return { ok: true, write, next };
}

function applyWrite(
	events: MatchEvent[],
	write: MatchEventWrite,
	seq: number,
	now: Date,
): MatchEvent[] {
	if (write.kind === 'undo') {
		return events.map((e) =>
			e.id === write.eventId
				? { ...e, undoneAt: now.toISOString(), undoneBy: write.actorId }
				: e,
		);
	}
	return [
		...events,
		{
			...write.event,
			id: `pending-${seq}`,
			matchId: '',
			seq,
			undoneAt: null,
			undoneBy: null,
			createdAt: now.toISOString(),
		},
	];
}
