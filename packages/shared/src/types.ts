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
