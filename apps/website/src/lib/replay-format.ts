import type { ReplayPlayer } from '@onog/shared';

/** `8:40`, or `1:02:05` for games over an hour */
export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);
	const ss = String(seconds).padStart(2, '0');
	if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
	return `${minutes}:${ss}`;
}

export function formatPlayedAt(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '–';
	return date.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Players grouped by team: `A, B vs C, D` */
export function formatTeams(players: ReplayPlayer[]): string {
	if (players.length === 0) return '–';
	const teams = new Map<number, string[]>();
	for (const player of players) {
		teams.set(player.team, [...(teams.get(player.team) ?? []), player.name]);
	}
	return [...teams.entries()]
		.sort(([a], [b]) => a - b)
		.map(([, names]) => names.join(', '))
		.join(' vs ');
}
