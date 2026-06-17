import { getDb } from '../db';
import { Gameday } from './gameday';

const models = [Gameday];

export async function initSchemas() {
	const db = await getDb();
	for (const model of models) {
		await db.query(model.schema);
	}
}

export { Gameday } from './gameday';
