/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import type { ReplayData } from '@onog/shared';
import { createLibraryExport, parseLibraryExport } from './replay-export';

const replay: ReplayData = {
	id: 'id-1',
	contentHash: 'hash-1',
	fileName: 'game.SC2Replay',
	importedAt: '2026-09-26T10:00:00Z',
	parserVersion: '0.1.0',
	playedAt: '2026-08-31T17:49:33Z',
	map: 'Rainfall LE',
	durationSeconds: 520,
	gameVersion: '97563',
	players: [
		{ name: 'A', toonHandle: '2-S2-1-1', race: 'Zerg', team: 0, control: 'human', result: 'Win' },
		{ name: 'AI', toonHandle: '0-S2-0-0', race: 'Terran', team: 1, control: 'ai' },
	],
	winner: ['A'],
	trackerEvents: [{ delta: 0, event: { PlayerSetup: { player_id: 1 } } }],
};

const now = new Date('2026-09-26T12:00:00Z');

describe('library export', () => {
	test('an exported library can be read back unchanged', () => {
		const text = JSON.stringify(createLibraryExport([replay], now));
		expect(parseLibraryExport(text)).toEqual({ ok: true, replays: [replay] });
	});

	test('the export carries a format version', () => {
		expect(createLibraryExport([], now)).toMatchObject({ format: 'onog-replay-library', formatVersion: 1 });
	});

	test('rejects text that is not JSON', () => {
		expect(parseLibraryExport('{ nope')).toEqual({ ok: false, error: 'Die Datei ist kein gültiges JSON.' });
	});

	test('rejects JSON from somewhere else', () => {
		const result = parseLibraryExport(JSON.stringify({ replays: [replay] }));
		expect(result).toEqual({ ok: false, error: 'Die Datei ist kein Export einer ONOG-Replay-Bibliothek.' });
	});

	test('rejects a file from a newer format version', () => {
		const text = JSON.stringify({ ...createLibraryExport([replay], now), formatVersion: 2 });
		expect(parseLibraryExport(text)).toMatchObject({ ok: false });
	});

	test('rejects the whole file if a single entry is damaged', () => {
		const damaged = { ...replay, id: 'id-2', contentHash: 'hash-2', durationSeconds: 'long' };
		const text = JSON.stringify(createLibraryExport([replay, damaged as unknown as ReplayData], now));
		expect(parseLibraryExport(text)).toEqual({
			ok: false,
			error: 'Die Datei enthält beschädigte Einträge und wurde nicht importiert.',
		});
	});
});
