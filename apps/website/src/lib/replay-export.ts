import type { ReplayData, ReplayPlayer } from '@onog/shared';

const FORMAT = 'onog-replay-library';
/** Bump when the file layout changes; `parseLibraryExport` must keep reading older versions */
const FORMAT_VERSION = 1;

export type LibraryExport = {
	format: typeof FORMAT;
	formatVersion: number;
	exportedAt: string;
	replays: ReplayData[];
};

export function createLibraryExport(replays: ReplayData[], now: Date): LibraryExport {
	return { format: FORMAT, formatVersion: FORMAT_VERSION, exportedAt: now.toISOString(), replays };
}

export function exportFileName(now: Date): string {
	return `onog-replays-${now.toISOString().slice(0, 10)}.json`;
}

export type ParseExportResult = { ok: true; replays: ReplayData[] } | { ok: false; error: string };

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function isReplayPlayer(value: unknown): value is ReplayPlayer {
	return (
		isRecord(value) &&
		isString(value.name) &&
		isString(value.toonHandle) &&
		isString(value.race) &&
		isNumber(value.team) &&
		['human', 'ai', 'unknown'].includes(value.control as string) &&
		(value.result === undefined || value.result === 'Win' || value.result === 'Loss')
	);
}

export function isReplayData(value: unknown): value is ReplayData {
	return (
		isRecord(value) &&
		isString(value.id) &&
		isString(value.contentHash) &&
		isString(value.fileName) &&
		isString(value.importedAt) &&
		isString(value.parserVersion) &&
		isString(value.playedAt) &&
		isString(value.map) &&
		isNumber(value.durationSeconds) &&
		isString(value.gameVersion) &&
		Array.isArray(value.players) &&
		value.players.every(isReplayPlayer) &&
		Array.isArray(value.winner) &&
		value.winner.every(isString) &&
		Array.isArray(value.trackerEvents)
	);
}

/**
 * Validates an export file before anything touches the library. All or
 * nothing: a single malformed entry rejects the whole file, so a foreign or
 * damaged file can never leave half-imported garbage behind.
 */
export function parseLibraryExport(text: string): ParseExportResult {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
	}

	if (!isRecord(data) || data.format !== FORMAT) {
		return { ok: false, error: 'Die Datei ist kein Export einer ONOG-Replay-Bibliothek.' };
	}
	if (!isNumber(data.formatVersion) || data.formatVersion > FORMAT_VERSION) {
		return { ok: false, error: 'Die Datei stammt aus einer neueren Version und kann nicht gelesen werden.' };
	}
	if (!Array.isArray(data.replays) || !data.replays.every(isReplayData)) {
		return { ok: false, error: 'Die Datei enthält beschädigte Einträge und wurde nicht importiert.' };
	}

	return { ok: true, replays: data.replays };
}
