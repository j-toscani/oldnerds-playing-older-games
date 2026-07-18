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
