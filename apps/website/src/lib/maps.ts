export type VetoedBy = 'p1' | 'p2' | null;

export type MapEntry = {
	name: string;
	vetoedBy: VetoedBy;
	order: number | null;
};

/** Current SC2 1v1 Ladder Map Pool (Season 2026) */
export const LADDER_MAPS_1V1: string[] = [
	'At Eternity\'s Edge LE (2)',
	'Blackrock LE (2)',
	'Fear and Faith LE (4)',
	'Lockdown LE (2)',
	'Old Sun Temple LE (4)',
	'Rainfall LE (2)',
	'Rorschach LE (2)',
	'Sanctuary III LE (2)',
	'Washout LE (2)',
];

export function createInitialMapEntries(): MapEntry[] {
	return LADDER_MAPS_1V1.map((name) => ({
		name,
		vetoedBy: null,
		order: null,
	}));
}
