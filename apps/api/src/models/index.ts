import { getDb } from '../db';
import type { Model } from './types';

// Register new models here so their schemas are applied on startup
const models: Model<{ id?: string }>[] = [];

export async function initSchemas() {
	const db = await getDb();
	for (const model of models) {
		await db.query(model.schema);
	}
}
