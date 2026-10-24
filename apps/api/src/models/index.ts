import { getDb } from '../db';
import { Match } from './match';
import { MatchEvents } from './match-event';
import type { Model } from './types';

// Register new models here so their schemas are applied on startup
const models: Model<{ id?: string }>[] = [Match, MatchEvents];

export async function initSchemas() {
	const db = await getDb();
	for (const model of models) {
		await db.query(model.schema);
	}
}
