import type { ReplayData } from '@onog/shared';
import { formatTeams } from './replay-format';

/** The replay's metadata, with its tracker events nested under `events` */
export type ReplayDownload = Omit<ReplayData, 'trackerEvents'> & { events: unknown[] };

export function toReplayDownload({ trackerEvents, ...metadata }: ReplayData): ReplayDownload {
	return { ...metadata, events: trackerEvents };
}

/** Local time, like the table shows it: `2026-08-31-1949` */
function fileDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return 'unbekannt';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/** Drops characters that Windows or macOS refuse in file names; whitespace becomes `-` */
function filePart(text: string): string {
	return text
		.replace(/[\\/:*?"<>|]/g, '')
		.trim()
		.replace(/\s+/g, '-');
}

/** Table columns joined by `_`: `Gespielt_Map_Spieler.json`, e.g. `2026-08-31-1949_Rainfall-LE_A+B-vs-C+D.json` */
export function downloadFileName(replay: ReplayData): string {
	const players = formatTeams(replay.players).replaceAll(', ', '+');
	return `${[fileDate(replay.playedAt), filePart(replay.map), filePart(players)].join('_')}.json`;
}
