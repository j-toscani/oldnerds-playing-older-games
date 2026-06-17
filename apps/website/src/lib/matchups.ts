import type { Matchup, MatchupWithState } from '@onog/shared';

export type { Matchup, MatchupWithState };

/**
 * Generate all unique pairings (round-robin) from a list of players.
 * Each pair appears exactly once.
 */
export function generateMatchups(players: string[]): Matchup[] {
	const matchups: Matchup[] = [];

	for (let i = 0; i < players.length; i++) {
		for (let j = i + 1; j < players.length; j++) {
			matchups.push({ player1: players[i], player2: players[j] });
		}
	}

	return matchups;
}

/**
 * Shuffle an array using Fisher-Yates algorithm.
 */
export function shuffle<T>(array: T[]): T[] {
	const result = [...array];

	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}

	return result;
}

/**
 * Sort matchups so that no player plays in two consecutive matches.
 * Uses a greedy approach: pick the next matchup whose players
 * didn't play in the previous match.
 * Falls back to any remaining matchup if no ideal one is found.
 */
export function sortMatchupsNoBackToBack(matchups: Matchup[]): Matchup[] {
	if (matchups.length <= 1) return [...matchups];

	const remaining = shuffle([...matchups]);
	const sorted: Matchup[] = [remaining.shift()!];

	while (remaining.length > 0) {
		const last = sorted[sorted.length - 1];
		const lastPlayers = new Set([last.player1, last.player2]);

		const idealIndex = remaining.findIndex(
			(m) => !lastPlayers.has(m.player1) && !lastPlayers.has(m.player2),
		);

		if (idealIndex !== -1) {
			sorted.push(remaining.splice(idealIndex, 1)[0]);
		} else {
			// No ideal match found — take the first remaining one
			sorted.push(remaining.shift()!);
		}
	}

	return sorted;
}

/**
 * Sort matchups with deactivated ones pushed to the end.
 * Active matchups maintain their relative order.
 */
export function sortWithDeactivatedLast(matchups: MatchupWithState[]): MatchupWithState[] {
	const active = matchups.filter((m) => m.active);
	const deactivated = matchups.filter((m) => !m.active);

	return [...active, ...deactivated];
}
