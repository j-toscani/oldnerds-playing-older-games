import type { ReplayData } from '@onog/shared';

export type { ReplayData };

const DB_NAME = 'onog-replays';
const STORE = 'replays';
/**
 * Bump only together with an additive step in `upgrade`. Never drop or
 * recreate the store: the library exists nowhere else.
 */
const DB_VERSION = 1;

export type SaveResult = { status: 'saved' } | { status: 'duplicate'; existing: ReplayData };

function upgrade(db: IDBDatabase, oldVersion: number): void {
	if (oldVersion < 1) {
		const store = db.createObjectStore(STORE, { keyPath: 'id' });
		store.createIndex('contentHash', 'contentHash', { unique: true });
		store.createIndex('playedAt', 'playedAt');
	}
}

function isAvailable(): boolean {
	// Also covers SSR: neither Node nor Bun provide IndexedDB
	return typeof indexedDB !== 'undefined';
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
		request.onsuccess = () => {
			const db = request.result;
			// Let a newer version in another tab upgrade instead of blocking it
			db.onversionchange = () => db.close();
			resolve(db);
		};
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error('Replay library is blocked by another open tab'));
	});
}

/**
 * Runs `work` in one transaction and resolves with its result once the
 * transaction has committed, so callers never see data that was rolled back.
 */
async function withStore<T>(
	mode: IDBTransactionMode,
	work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
	const db = await openDb();
	try {
		const tx = db.transaction(STORE, mode);
		const committed = new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
		});
		const result = await work(tx.objectStore(STORE));
		await committed;
		return result;
	} finally {
		db.close();
	}
}

/**
 * Stores a replay unless one with the same `contentHash` exists. The unique
 * index is the actual guarantee; the lookup only gives the caller the existing
 * entry to point at.
 */
export async function saveReplay(replay: ReplayData): Promise<SaveResult> {
	if (!isAvailable()) throw new Error('IndexedDB is not available');

	try {
		return await withStore('readwrite', async (store) => {
			const existing = await promisify<ReplayData | undefined>(
				store.index('contentHash').get(replay.contentHash),
			);
			if (existing) return { status: 'duplicate', existing } satisfies SaveResult;

			await promisify(store.add(replay));
			return { status: 'saved' } satisfies SaveResult;
		});
	} catch (error) {
		// Another tab saved the same file between our lookup and the add
		if (error instanceof DOMException && error.name === 'ConstraintError') {
			const existing = await findByContentHash(replay.contentHash);
			if (existing) return { status: 'duplicate', existing };
		}
		throw error;
	}
}

async function findByContentHash(contentHash: string): Promise<ReplayData | undefined> {
	return withStore('readonly', (store) => promisify(store.index('contentHash').get(contentHash)));
}

/** All replays, most recently played first (walks the `playedAt` index backwards) */
export async function listReplays(): Promise<ReplayData[]> {
	if (!isAvailable()) return [];

	return withStore(
		'readonly',
		(store) =>
			new Promise<ReplayData[]>((resolve, reject) => {
				const replays: ReplayData[] = [];
				const request = store.index('playedAt').openCursor(null, 'prev');
				request.onsuccess = () => {
					const cursor = request.result;
					if (!cursor) return resolve(replays);
					replays.push(cursor.value as ReplayData);
					cursor.continue();
				};
				request.onerror = () => reject(request.error);
			}),
	);
}

export async function getReplay(id: string): Promise<ReplayData | undefined> {
	if (!isAvailable()) return undefined;
	return withStore('readonly', (store) => promisify<ReplayData | undefined>(store.get(id)));
}

export async function deleteReplay(id: string): Promise<void> {
	if (!isAvailable()) return;
	await withStore('readwrite', (store) => promisify(store.delete(id)));
}

export async function clearReplays(): Promise<void> {
	if (!isAvailable()) return;
	await withStore('readwrite', (store) => promisify(store.clear()));
}

/** Random id that also works outside secure contexts, where `randomUUID` is missing (e.g. dev via LAN IP) */
export function createReplayId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
		byte.toString(16).padStart(2, '0'),
	).join('');
}
