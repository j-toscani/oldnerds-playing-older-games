export type VetoedBy = 'p1' | 'p2' | null;

export type MapEntry = {
	name: string;
	vetoedBy: VetoedBy;
	order: number | null;
};

/** Current SC2 1v1 Ladder Map Pool (Season 2026) */
export const LADDER_MAPS_1V1: string[] = [
	'10000 Feet LE',
	'Celestial Enclave LE',
	'Mothership LE',
	'Old Republic LE',
	'Ruby Rock LE',
	'Taito Citadel LE',
	'Tourmaline LE',
	'White Rabbit LE',
	'Winter Madness LE',
];

export function createInitialMapEntries(): MapEntry[] {
	return LADDER_MAPS_1V1.map((name) => ({
		name,
		vetoedBy: null,
		order: null,
	}));
}
