import { Surreal } from 'surrealdb';
import { logger } from '@onog/shared';
import { config } from './config';

let db: Surreal | null = null;

export async function getDb(): Promise<Surreal> {
	if (db?.isConnected) return db;

	db = new Surreal();

	try {
		// Unlike `signin()`, the SDK reuses these credentials when the session token
		// expires or the socket reconnects; otherwise the session falls back to anonymous
		const connectPromise = db.connect(config.SURREAL_URL, {
			namespace: config.SURREAL_NAMESPACE,
			database: config.SURREAL_DATABASE,
			authentication: {
				username: config.SURREAL_USER,
				password: config.SURREAL_PASS,
			},
		});
		const timeout = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`[DB] Connection timeout after 5s – is SurrealDB running at ${config.SURREAL_URL}?`)), 5000)
		);

		await Promise.race([connectPromise, timeout]);
	} catch (error) {
		db = null;
		logger.error('Failed to connect:', error instanceof Error ? error.message : error);
		throw error;
	}

	return db;
}

export async function closeDb(): Promise<void> {
	if (db) {
		await db.close();
		db = null;
	}
}
