/** Mirrored from apps/api/src/models/gameday.ts (SurrealDB schema) */

export type Matchup = {
	player1: string;
	player2: string;
};

/** Reference to one of the two participant slots of a matchup. */
export type MatchupSlot = 'player1' | 'player2';

export type MatchupWithState = Matchup & {
	active: boolean;
	/**
	 * The official winner of the matchup — a reference to one of the two
	 * participant slots. Absent while the matchup is undecided.
	 */
	winner?: MatchupSlot;
	/** Optional human-readable score, e.g. "2:1". */
	score?: string;
	/** Optional reference to a replay record that produced this result. */
	replayId?: string;
};

export type GamedayData = {
	id?: string;
	players: string[];
	matchups: MatchupWithState[] | null;
	noBackToBack: boolean;
};

export type User = {
	discordId: string;
	username: string;
	avatar: string | null;
};

/**
 * Live-update channel (SSE) — shared envelope for the per-gameday event stream.
 *
 * Every server → client message uses the same `{ type, payload }` envelope so
 * new event types can be added additively. New consumers dispatch on `type`.
 */
export type GamedayEventType =
	| 'connected'
	| 'standings-updated'
	| 'matchup-updated'
	| 'replay-status';

export type GamedayEvent<TPayload = unknown> = {
	type: GamedayEventType;
	payload: TPayload;
};
