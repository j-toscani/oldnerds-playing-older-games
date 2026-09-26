/// <reference types="bun" />
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ReplayData } from '@onog/shared';
import { clearReplays, deleteReplay, getReplay, listReplays, saveReplay } from './replay-db';

function replay(overrides: Partial<ReplayData> = {}): ReplayData {
	return {
		id: 'id-1',
		contentHash: 'hash-1',
		fileName: 'game.SC2Replay',
		importedAt: '2026-09-26T10:00:00Z',
		parserVersion: '0.1.0',
		playedAt: '2026-08-31T17:49:33Z',
		map: 'Rainfall LE',
		durationSeconds: 520,
		gameVersion: '97563',
		players: [],
		winner: [],
		trackerEvents: [],
		...overrides,
	};
}

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory();
});

describe('replay library', () => {
	test('a saved replay can be read back by id', async () => {
		expect(await saveReplay(replay())).toEqual({ status: 'saved' });
		expect(await getReplay('id-1')).toEqual(replay());
	});

	test('the same file content is stored only once, whatever the file name', async () => {
		await saveReplay(replay());
		const result = await saveReplay(replay({ id: 'id-2', fileName: 'renamed.SC2Replay' }));

		expect(result).toEqual({ status: 'duplicate', existing: replay() });
		expect(await listReplays()).toHaveLength(1);
	});

	test('lists the most recently played replay first', async () => {
		await saveReplay(replay({ id: 'old', contentHash: 'a', playedAt: '2025-01-01T00:00:00Z' }));
		await saveReplay(replay({ id: 'new', contentHash: 'b', playedAt: '2026-01-01T00:00:00Z' }));
		await saveReplay(replay({ id: 'mid', contentHash: 'c', playedAt: '2025-06-01T00:00:00Z' }));

		expect((await listReplays()).map((r) => r.id)).toEqual(['new', 'mid', 'old']);
	});

	test('deleting one replay keeps the others', async () => {
		await saveReplay(replay({ id: 'keep', contentHash: 'a' }));
		await saveReplay(replay({ id: 'drop', contentHash: 'b' }));

		await deleteReplay('drop');

		expect((await listReplays()).map((r) => r.id)).toEqual(['keep']);
		expect(await getReplay('drop')).toBeUndefined();
	});

	test('a deleted replay can be imported again', async () => {
		await saveReplay(replay());
		await deleteReplay('id-1');

		expect(await saveReplay(replay({ id: 'id-2' }))).toEqual({ status: 'saved' });
	});

	test('clearing empties the library', async () => {
		await saveReplay(replay({ id: 'a', contentHash: 'a' }));
		await saveReplay(replay({ id: 'b', contentHash: 'b' }));

		await clearReplays();

		expect(await listReplays()).toEqual([]);
	});
});
