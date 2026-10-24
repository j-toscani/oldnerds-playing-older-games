/** Gameday state lives only in the browser's localStorage (see apps/website/src/lib/storage.ts) */

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

/** Why the Discord login callback sent the user to the website's `/login-error` page */
export type LoginErrorReason = 'not_a_member' | 'login_failed';

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
	/**
	 * Raw tracker events as `s2protocol` serializes them, e.g.
	 * `{ delta: 16, event: { UnitBorn: { … } } }` — `delta` is game loops since
	 * the previous event. Deliberately untyped until we know which parts the
	 * build-order work needs.
	 */
	trackerEvents: unknown[];
};

/** A replay as stored in the local library */
export type ReplayData = ParsedReplay & {
	id: string;
	fileName: string;
	/** ISO 8601, UTC */
	importedAt: string;
};

/** Mirrors the `match` model in apps/api/src/models/match.ts */

export type MatchFormat = 'bo3' | 'bo5' | 'bo7';

export type MatchStatus = 'veto' | 'pick' | 'playing' | 'finished' | 'aborted';

/** A match has exactly two `player` entries and one `organizer`; an organizer who plays appears twice */
export type MatchParticipant = {
	discordId: string;
	/** Display name at the time the match was created */
	name: string;
	role: 'player' | 'organizer';
};

export type MatchData = {
	id: string;
	participants: MatchParticipant[];
	format: MatchFormat;
	/** Snapshot of the map pool when the match was created */
	mapPool: string[];
	vetoStarterId: string;
	/** Cached from the events, see `MatchState.phase` */
	status: MatchStatus;
	/** Increases with every action; guards against concurrent clicks */
	version: number;
	winnerId: string | null;
	guildId: string;
	channelId: string;
	/** ISO 8601 */
	createdAt: string;
	/** ISO 8601, time of the last action */
	updatedAt: string;
	/** ISO 8601 */
	finishedAt: string | null;
};

/** Mirrors the `match_event` model in apps/api/src/models/match-event.ts */

export type MatchEventType = 'veto' | 'pick' | 'result' | 'abort';

export type MatchEvent = {
	id: string;
	matchId: string;
	/** The match version this event produced */
	seq: number;
	type: MatchEventType;
	map: string | null;
	/** Whom the event is for: the vetoing/picking player or the map winner */
	playerId: string | null;
	/** Who clicked; differs from `playerId` when the organizer acts for a player */
	actorId: string;
	/** ISO 8601; set when the event was undone, which keeps it in the history */
	undoneAt: string | null;
	undoneBy: string | null;
	/** ISO 8601 */
	createdAt: string;
};

/** The state of a match as derived from its events, which the bot renders */
export type MatchState = {
	matchId: string;
	version: number;
	format: MatchFormat;
	phase: MatchStatus;
	players: [MatchParticipant, MatchParticipant];
	organizer: MatchParticipant;
	mapPool: string[];
	vetoes: { map: string; playerId: string }[];
	/** Maps not vetoed, in pool order */
	remainingMaps: string[];
	/** Play order so far; `pickedById` is null for the map that was left over */
	order: { map: string; pickedById: string | null }[];
	/** Whose turn it is to veto or pick */
	turnId: string | null;
	/** Maps in play order with their winner, once the order is complete */
	games: { map: string; winnerId: string | null }[];
	currentMap: string | null;
	wins: Record<string, number>;
	winsNeeded: number;
	winnerId: string | null;
};
