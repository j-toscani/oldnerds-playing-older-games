/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { initSync, parse } from '@onog/replay-parser';
import { isReplayData } from './replay-export';

const parserDir = new URL('../../../../packages/replay-parser/', import.meta.url);

// Guards the boundary between the Rust structs and the `ReplayData` type: if a
// field is renamed or changes shape on either side, this goes red instead of
// the library silently storing something the UI and the importer can't read.
test('the checked-in parser returns what ReplayData describes', async () => {
	initSync({ module: await readFile(new URL('pkg/replay_parser_bg.wasm', parserDir)) });
	const bytes = new Uint8Array(await readFile(new URL('tests/fixtures/Burrow.SC2Replay', parserDir)));

	const replay = { ...parse(bytes), id: 'id', fileName: 'Burrow.SC2Replay', importedAt: '2026-09-26T10:00:00Z' };

	expect(replay.players.length).toBeGreaterThan(0);
	expect(replay.trackerEvents.length).toBeGreaterThan(0);
	expect(isReplayData(replay)).toBe(true);
});
