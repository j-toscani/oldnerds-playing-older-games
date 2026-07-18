import { RecordId, Table } from 'surrealdb';
import type { GamedayData } from '@onog/shared';
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
		// SurrealDB stores an absent optional field as NONE, which the SDK reads
		// back as `undefined`. Normalize to `null` to honor the shared contract.
		matchups: record.matchups ?? null,
		noBackToBack: record.noBackToBack,
	};
}

// `matchups` is an `option<...>` field: SurrealDB accepts NONE (field absent) or
// an array, but rejects a JS `null` (which maps to SurrealDB NULL). Drop the key
// when it is null/undefined so it is stored as NONE instead of crashing.
function toContent<T extends Partial<Omit<GamedayData, 'id'>>>(data: T) {
	const { matchups, ...rest } = data;
	return matchups == null ? rest : { ...rest, matchups };
}

interface GamedayModel extends Model<GamedayData & { id: string }> {
	update(
		id: string,
		data: Partial<Omit<GamedayData, 'id'>>,
	): Promise<(GamedayData & { id: string }) | null>;
}

export const Gameday: GamedayModel = {
	schema: `
		DEFINE TABLE OVERWRITE gameday SCHEMAFULL;
		DEFINE FIELD OVERWRITE players             ON TABLE gameday TYPE array<string>;
		DEFINE FIELD OVERWRITE matchups            ON TABLE gameday TYPE option<array<object>>;
		DEFINE FIELD OVERWRITE matchups[*].player1 ON TABLE gameday TYPE string;
		DEFINE FIELD OVERWRITE matchups[*].player2 ON TABLE gameday TYPE string;
		DEFINE FIELD OVERWRITE matchups[*].active  ON TABLE gameday TYPE bool;
		DEFINE FIELD OVERWRITE noBackToBack        ON TABLE gameday TYPE bool DEFAULT true;
		DEFINE FIELD OVERWRITE createdAt           ON TABLE gameday TYPE datetime DEFAULT time::now();
	`,

	async create(data) {
		const db = await getDb();
		const record = await db
			.create<GamedayRecord>(new Table('gameday'))
			.content({
				...toContent(data),
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
				.merge(toContent(data));
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
