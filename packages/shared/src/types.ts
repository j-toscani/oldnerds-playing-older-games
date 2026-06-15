/** Mirrored from apps/api/src/schema/gameday.ts (Surqlize) */

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
