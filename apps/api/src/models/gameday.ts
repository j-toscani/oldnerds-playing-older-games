import { RecordId, Table } from 'surrealdb';
import type { GamedayData } from '@ong/shared';
import type { Model } from './types';
import { getDb } from '../db';

type GamedayRecord = Omit<GamedayData, 'id'> & {
	id: RecordId;
	createdAt: Date;
};

function toResponse(record: GamedayRecord): GamedayData & { id: string } {
	return {
		id: record.id.id as string,
		players: record.players,
		matchups: record.matchups,
		noBackToBack: record.noBackToBack,
	};
}

interface GamedayModel extends Model<GamedayData & { id: string }> {
	update(
		id: string,
		data: Partial<Omit<GamedayData, 'id'>>,
	): Promise<(GamedayData & { id: string }) | null>;
}

export const Gameday: GamedayModel = {
	schema: `
		DEFINE TABLE gameday SCHEMAFULL OVERWRITE;
		DEFINE FIELD players      ON TABLE gameday TYPE array<string> OVERWRITE;
		DEFINE FIELD matchups     ON TABLE gameday TYPE option<array<object>> OVERWRITE;
		DEFINE FIELD noBackToBack ON TABLE gameday TYPE bool DEFAULT true OVERWRITE;
		DEFINE FIELD createdAt    ON TABLE gameday TYPE datetime DEFAULT time::now() OVERWRITE;
	`,

	async create(data) {
		const db = await getDb();
		const record = await db
			.create<GamedayRecord>(new Table('gameday'))
			.content({
				players: data.players,
				matchups: data.matchups,
				noBackToBack: data.noBackToBack,
				createdAt: new Date(),
			});
		// create with Table returns an array
		const created = Array.isArray(record) ? record[0] : record;
		return toResponse(created);
	},

	async findById(id) {
		const db = await getDb();
		try {
			const record = await db.select<GamedayRecord>(
				new RecordId('gameday', id),
			);
			return record ? toResponse(record) : null;
		} catch {
			return null;
		}
	},

	async find() {
		const db = await getDb();
		const records = await db.select<GamedayRecord>(new Table('gameday'));
		return records.map(toResponse);
	},

	async update(id, data) {
		const db = await getDb();
		try {
			const record = await db
				.update<GamedayRecord>(new RecordId('gameday', id))
				.merge(data);
			return record ? toResponse(record) : null;
		} catch {
			return null;
		}
	},

	async remove(id) {
		const db = await getDb();
		await db.delete(new RecordId('gameday', id));
	},
};
