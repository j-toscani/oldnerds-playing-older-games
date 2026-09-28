import type { ReplayData } from '@onog/shared';
import { strToU8, zip } from 'fflate';
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

/** `-2`, `-3` … for replays that would otherwise land on the same name, e.g. a rematch within the same minute */
function uniqueFileNames(replays: ReplayData[]): string[] {
	const seen = new Map<string, number>();
	return replays.map((replay) => {
		const name = downloadFileName(replay);
		const count = (seen.get(name) ?? 0) + 1;
		seen.set(name, count);
		return count === 1 ? name : name.replace(/\.json$/, `-${count}.json`);
	});
}

/** Every replay as its own JSON file, the same as a single download would produce */
export function createLibraryZip(replays: ReplayData[]): Promise<Uint8Array<ArrayBuffer>> {
	const names = uniqueFileNames(replays);
	const files = Object.fromEntries(
		replays.map((replay, i) => [names[i], strToU8(JSON.stringify(toReplayDownload(replay), null, 2))]),
	);
	return new Promise((resolve, reject) => {
		// Async so the compression runs in a worker and the page stays responsive
		// fflate never allocates a SharedArrayBuffer; the narrower type is what `Blob` accepts
		zip(files, (error, data) => (error ? reject(error) : resolve(data as Uint8Array<ArrayBuffer>)));
	});
}

export function libraryZipFileName(now: Date): string {
	return `onog-replays-${now.toISOString().slice(0, 10)}.zip`;
}
