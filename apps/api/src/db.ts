import { Surreal } from 'surrealdb';

const SURREAL_URL = process.env.SURREAL_URL ?? 'ws://localhost:8000';
const SURREAL_NAMESPACE = process.env.SURREAL_NAMESPACE ?? 'onog';
const SURREAL_DATABASE = process.env.SURREAL_DATABASE ?? 'onog';
const SURREAL_USER = process.env.SURREAL_USER ?? 'root';
const SURREAL_PASS = process.env.SURREAL_PASS ?? 'root';

let db: Surreal | null = null;

export async function getDb(): Promise<Surreal> {
	if (db?.isConnected) return db;

	db = new Surreal();

	try {
		await db.connect(SURREAL_URL);
		await db.use({
			namespace: SURREAL_NAMESPACE,
			database: SURREAL_DATABASE,
		});
		await db.signin({
			username: SURREAL_USER,
			password: SURREAL_PASS,
		});

		console.log(`✅ SurrealDB verbunden: ${SURREAL_URL} (${SURREAL_NAMESPACE}/${SURREAL_DATABASE})`);
	} catch (error) {
		console.error('❌ SurrealDB Verbindung fehlgeschlagen:', error);
		db = null;
		throw error;
	}

	return db;
}

export async function closeDb(): Promise<void> {
	if (db) {
		await db.close();
		db = null;
		console.log('🔌 SurrealDB Verbindung geschlossen');
	}
}
