import type { MatchupWithState } from './matchups';

const STORAGE_KEY = 'ong-gameday';

export type GamedayData = {
	players: string[];
	matchups: MatchupWithState[] | null;
	noBackToBack: boolean;
};

const defaultData: GamedayData = {
	players: [],
	matchups: null,
	noBackToBack: true,
};

export function loadGameday(): GamedayData {
	if (typeof window === 'undefined') return defaultData;

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultData;
		return JSON.parse(raw) as GamedayData;
	} catch {
		return defaultData;
	}
}

export function saveGameday(data: GamedayData): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearGameday(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(STORAGE_KEY);
}
