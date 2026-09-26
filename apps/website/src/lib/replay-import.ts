import type { ParsedReplay, ReplayData } from '@onog/shared';
import type { SaveResult } from './replay-db';

export type FileImportState =
	| { status: 'pending' }
	| { status: 'parsing' }
	| { status: 'saved'; replay: ReplayData }
	| { status: 'duplicate'; existing: ReplayData }
	| { status: 'error'; message: string };

export type FileImport = { fileName: string } & FileImportState;

export type ImportDeps = {
	parse: (bytes: Uint8Array) => ParsedReplay;
	save: (replay: ReplayData) => Promise<SaveResult>;
	createId: () => string;
	now: () => Date;
	/** Called after every state change, with a fresh array */
	onProgress: (imports: FileImport[]) => void;
	/** Called once, after the first replay was actually stored */
	onFirstSave?: () => void;
};

type ReplayFile = { name: string; arrayBuffer: () => Promise<ArrayBuffer> };

/**
 * Maps a parser failure to user-facing copy. The Rust side throws plain
 * strings; anything else (e.g. a `RuntimeError` from a trap) gets the generic
 * message, since there is nothing more specific to say.
 */
export function describeParseError(error: unknown): string {
	if (typeof error === 'string') {
		if (error.startsWith('not a StarCraft II replay')) return 'Keine StarCraft-II-Replay-Datei.';
		if (error.includes('truncated or corrupt')) return 'Die Datei ist beschädigt oder unvollständig.';
	}
	return 'Die Datei konnte nicht gelesen werden.';
}

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Parses and stores files one after another. A failing file is recorded and
 * skipped — it never stops the rest. Yields between files so per-file progress
 * actually renders instead of the whole batch finishing in one task.
 */
export async function importReplayFiles(files: ReplayFile[], deps: ImportDeps): Promise<FileImport[]> {
	const imports: FileImport[] = files.map((file) => ({ fileName: file.name, status: 'pending' }));
	const update = (index: number, state: FileImportState) => {
		imports[index] = { fileName: files[index].name, ...state };
		deps.onProgress([...imports]);
	};
	let savedAny = false;

	deps.onProgress([...imports]);

	for (const [index, file] of files.entries()) {
		update(index, { status: 'parsing' });
		await yieldToEventLoop();

		let parsed: ParsedReplay;
		try {
			parsed = deps.parse(new Uint8Array(await file.arrayBuffer()));
		} catch (error) {
			update(index, { status: 'error', message: describeParseError(error) });
			continue;
		}

		const replay: ReplayData = {
			...parsed,
			id: deps.createId(),
			fileName: file.name,
			importedAt: deps.now().toISOString(),
		};

		try {
			const result = await deps.save(replay);
			if (result.status === 'duplicate') {
				update(index, { status: 'duplicate', existing: result.existing });
				continue;
			}
		} catch (error) {
			console.error('Failed to store replay', file.name, error);
			update(index, { status: 'error', message: 'Das Replay konnte nicht gespeichert werden.' });
			continue;
		}

		update(index, { status: 'saved', replay });
		if (!savedAny) {
			savedAny = true;
			deps.onFirstSave?.();
		}
	}

	return imports;
}

/**
 * Asks the browser not to evict the library under storage pressure (Safari is
 * quick to do so otherwise). Best effort: missing support or a refusal is fine.
 */
export async function requestPersistentStorage(): Promise<void> {
	if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
	try {
		if (await navigator.storage.persisted()) return;
		await navigator.storage.persist();
	} catch (error) {
		console.warn('Could not request persistent storage', error);
	}
}
