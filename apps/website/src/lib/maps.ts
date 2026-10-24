import { LADDER_MAPS_1V1 } from '@onog/shared';

export type VetoedBy = 'p1' | 'p2' | null;

export type MapEntry = {
	name: string;
	vetoedBy: VetoedBy;
	order: number | null;
};

export function createInitialMapEntries(): MapEntry[] {
	return LADDER_MAPS_1V1.map((name) => ({
		name,
		vetoedBy: null,
		order: null,
	}));
}
