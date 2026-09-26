/// <reference types="bun" />
import { describe, expect, mock, test } from 'bun:test';
import type { ParsedReplay, ReplayData } from '@onog/shared';
import { importReplayFiles, type FileImport, type ImportDeps } from './replay-import';
import type { SaveResult } from './replay-db';

function file(name: string, content: string) {
	return { name, arrayBuffer: async () => new TextEncoder().encode(content).buffer as ArrayBuffer };
}

function parsed(contentHash: string): ParsedReplay {
	return {
		contentHash,
		parserVersion: '0.1.0',
		playedAt: '2026-08-31T17:49:33Z',
		map: 'Rainfall LE',
		durationSeconds: 520,
		gameVersion: '97563',
		players: [],
		winner: [],
	};
}

/** Parses "ok:<hash>" contents, throws the given string for anything else */
function deps(overrides: Partial<ImportDeps> = {}): ImportDeps & { stored: ReplayData[]; snapshots: FileImport[][] } {
	const stored: ReplayData[] = [];
	const snapshots: FileImport[][] = [];
	let nextId = 0;
	return {
		stored,
		snapshots,
		parse: (bytes) => {
			const text = new TextDecoder().decode(bytes);
			if (!text.startsWith('ok:')) throw text;
			return parsed(text.slice(3));
		},
		save: async (replay): Promise<SaveResult> => {
			const existing = stored.find((r) => r.contentHash === replay.contentHash);
			if (existing) return { status: 'duplicate', existing };
			stored.push(replay);
			return { status: 'saved' };
		},
		createId: () => `id-${++nextId}`,
		now: () => new Date('2026-09-26T10:00:00Z'),
		onProgress: (imports) => snapshots.push(imports),
		...overrides,
	};
}

describe('importReplayFiles', () => {
	test('stores a parsed replay with id, file name and import time', async () => {
		const d = deps();
		const [result] = await importReplayFiles([file('a.SC2Replay', 'ok:h1')], d);

		const expected = { ...parsed('h1'), id: 'id-1', fileName: 'a.SC2Replay', importedAt: '2026-09-26T10:00:00.000Z' };
		expect(result).toEqual({ fileName: 'a.SC2Replay', status: 'saved', replay: expected });
		expect(d.stored).toEqual([expected]);
	});

	test('a broken file is reported and the remaining files are still imported', async () => {
		const d = deps();
		const results = await importReplayFiles(
			[
				file('good-1.SC2Replay', 'ok:h1'),
				file('notes.txt', 'not a StarCraft II replay file'),
				file('cut.SC2Replay', 'replay file is truncated or corrupt'),
				file('good-2.SC2Replay', 'ok:h2'),
			],
			d,
		);

		expect(results.map((r) => r.status)).toEqual(['saved', 'error', 'error', 'saved']);
		expect(results[1]).toMatchObject({ message: 'Keine StarCraft-II-Replay-Datei.' });
		expect(results[2]).toMatchObject({ message: 'Die Datei ist beschädigt oder unvollständig.' });
		expect(d.stored.map((r) => r.contentHash)).toEqual(['h1', 'h2']);
	});

	test('an unexpected parser failure gets a generic message', async () => {
		const d = deps({
			parse: () => {
				throw new WebAssembly.RuntimeError('unreachable');
			},
		});
		const [result] = await importReplayFiles([file('x.SC2Replay', '')], d);

		expect(result).toEqual({ fileName: 'x.SC2Replay', status: 'error', message: 'Die Datei konnte nicht gelesen werden.' });
	});

	test('reports per file which replay was new and which was already in the library', async () => {
		const d = deps();
		await importReplayFiles([file('first.SC2Replay', 'ok:h1')], d);

		const results = await importReplayFiles(
			[file('copy-of-first.SC2Replay', 'ok:h1'), file('new.SC2Replay', 'ok:h2')],
			d,
		);

		expect(results[0]).toMatchObject({ status: 'duplicate', existing: { fileName: 'first.SC2Replay' } });
		expect(results[1]).toMatchObject({ status: 'saved' });
		expect(d.stored).toHaveLength(2);
	});

	test('a storage failure is reported per file without stopping the batch', async () => {
		let calls = 0;
		const d = deps({
			save: async () => {
				if (++calls === 1) throw new Error('QuotaExceededError');
				return { status: 'saved' };
			},
		});
		const originalError = console.error;
		console.error = () => {};
		try {
			const results = await importReplayFiles([file('a.SC2Replay', 'ok:h1'), file('b.SC2Replay', 'ok:h2')], d);
			expect(results.map((r) => r.status)).toEqual(['error', 'saved']);
		} finally {
			console.error = originalError;
		}
	});

	test('progress shows each file moving from pending through parsing to its result', async () => {
		const d = deps();
		await importReplayFiles([file('a.SC2Replay', 'ok:h1'), file('b.SC2Replay', 'ok:h2')], d);

		expect(d.snapshots.map((s) => s.map((f) => f.status).join(','))).toEqual([
			'pending,pending',
			'parsing,pending',
			'saved,pending',
			'saved,parsing',
			'saved,saved',
		]);
	});

	test('asks for persistent storage once, after the first replay is actually stored', async () => {
		const onFirstSave = mock(() => {});
		const d = deps({ onFirstSave });
		await importReplayFiles([file('bad', 'nope')], d);
		expect(onFirstSave).not.toHaveBeenCalled();

		await importReplayFiles([file('a', 'ok:h1'), file('b', 'ok:h2')], d);
		expect(onFirstSave).toHaveBeenCalledTimes(1);
	});
});
