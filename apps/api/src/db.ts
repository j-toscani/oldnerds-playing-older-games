import { Surreal } from 'surrealdb';
import { config } from './config';

let db: Surreal | null = null;

export async function getDb(): Promise<Surreal> {
	if (db?.isConnected) return db;

	db = new Surreal();

	try {
		await db.connect(config.SURREAL_URL);
		await db.use({
			namespace: config.SURREAL_NAMESPACE,
			database: config.SURREAL_DATABASE,
		});
		await db.signin({
			username: config.SURREAL_USER,
			password: config.SURREAL_PASS,
		});
	} catch (error) {
		db = null;
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
