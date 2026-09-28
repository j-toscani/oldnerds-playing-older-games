/// <reference types="bun" />
// The file name uses local time like the table, so pin the zone for stable results
process.env.TZ = 'Europe/Berlin';
import { describe, expect, test } from 'bun:test';
import type { ReplayData } from '@onog/shared';
import { downloadFileName, toReplayDownload } from './replay-download';

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
	players: [{ name: 'A', toonHandle: '2-S2-1-1', race: 'Zerg', team: 0, control: 'human', result: 'Win' }],
	winner: ['A'],
	trackerEvents: [{ delta: 0, event: { PlayerSetup: { player_id: 1 } } }],
};

describe('replay download', () => {
	test('nests the tracker events under `events` next to the metadata', () => {
		const { trackerEvents, ...metadata } = replay;
		expect(toReplayDownload(replay)).toEqual({ ...metadata, events: trackerEvents });
	});

	test('names the file after the table columns: played, map, players', () => {
		expect(downloadFileName(replay)).toBe('2026-08-31-1949_Rainfall-LE_A.json');
	});

	test('joins team mates with + and teams with -vs-', () => {
		const players: ReplayData['players'] = ['A', 'B', 'C', 'D'].map((name, i) => ({
			name,
			toonHandle: '1-S2-1-1',
			race: 'Zerg',
			team: i < 2 ? 0 : 1,
			control: 'human',
		}));
		expect(downloadFileName({ ...replay, players })).toBe('2026-08-31-1949_Rainfall-LE_A+B-vs-C+D.json');
	});

	test('drops characters that are not allowed in file names', () => {
		expect(downloadFileName({ ...replay, map: 'Map: 2/3?' })).toBe('2026-08-31-1949_Map-23_A.json');
	});
});
