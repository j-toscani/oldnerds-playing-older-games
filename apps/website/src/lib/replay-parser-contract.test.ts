/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { initSync, parse } from '@onog/replay-parser';
import type { ReplayData, ReplayPlayer } from '@onog/shared';

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

function isReplayData(value: unknown): value is ReplayData {
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

const parserDir = new URL('../../../../packages/replay-parser/', import.meta.url);

// Guards the boundary between the Rust structs and the `ReplayData` type: if a
// field is renamed or changes shape on either side, this goes red instead of
// the library silently storing something the UI and the download can't read.
test('the checked-in parser returns what ReplayData describes', async () => {
	initSync({ module: await readFile(new URL('pkg/replay_parser_bg.wasm', parserDir)) });
	const bytes = new Uint8Array(await readFile(new URL('tests/fixtures/Burrow.SC2Replay', parserDir)));

	const replay = { ...parse(bytes), id: 'id', fileName: 'Burrow.SC2Replay', importedAt: '2026-09-26T10:00:00Z' };

	expect(replay.players.length).toBeGreaterThan(0);
	expect(replay.trackerEvents.length).toBeGreaterThan(0);
	expect(isReplayData(replay)).toBe(true);
});
