/** Mirrored from apps/api/src/models/gameday.ts (SurrealDB schema) */

export type Matchup = {
	player1: string;
	player2: string;
};

export type MatchupWithState = Matchup & {
	active: boolean;
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
 * Not mirrored from a SurrealDB model: replays live only in the browser's
 * IndexedDB (see docs/features/replay-library-local.md). If a `replay` model is
 * ever added, the usual sync-schema-types rule applies.
 */

export type ReplayPlayer = {
	name: string;
	/** `<region>-S2-<realm>-<id>`; AI players carry `0-S2-0-0` */
	toonHandle: string;
	race: string;
	team: number;
	control: 'human' | 'ai' | 'unknown';
	/** Absent when the replay doesn't record a result for this player */
	result?: 'Win' | 'Loss';
};

/** What `@onog/replay-parser` returns for one replay file */
export type ParsedReplay = {
	/** SHA-256 of the file bytes, the device-independent identity of a replay */
	contentHash: string;
	parserVersion: string;
	/** ISO 8601, UTC */
	playedAt: string;
	map: string;
	durationSeconds: number;
	/** Base build number, e.g. `"97563"` */
	gameVersion: string;
	players: ReplayPlayer[];
	/** Names of every player whose result is `Win`; empty when not derivable */
	winner: string[];
};

/** A replay as stored in the local library */
export type ReplayData = ParsedReplay & {
	id: string;
	fileName: string;
	/** ISO 8601, UTC */
	importedAt: string;
};
