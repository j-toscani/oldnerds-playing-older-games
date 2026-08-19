import { RecordId, Table } from 'surrealdb';
import type { GamedayData, MatchupWithState } from '@onog/shared';
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

// The optional matchup-result fields (`winner`, `score`, `replayId`) are
// `option<...>` in the schema: SurrealDB accepts NONE (key absent) but rejects a
// JS `null` (which maps to SurrealDB NULL). Drop null/undefined keys so absent
// results are stored as NONE instead of crashing the write.
function sanitizeMatchup(matchup: MatchupWithState): Record<string, unknown> {
	const clean: Record<string, unknown> = {
		player1: matchup.player1,
		player2: matchup.player2,
		active: matchup.active,
	};
	if (matchup.winner != null) clean.winner = matchup.winner;
	if (matchup.score != null) clean.score = matchup.score;
	if (matchup.replayId != null) clean.replayId = matchup.replayId;
	return clean;
}

// `matchups` is itself an `option<...>` field: SurrealDB accepts NONE (field
// absent) or an array, but rejects a JS `null`. Drop the key when it is
// null/undefined so it is stored as NONE, and sanitize each matchup object.
function toContent<T extends Partial<Omit<GamedayData, 'id'>>>(data: T) {
	const { matchups, ...rest } = data;
	return matchups == null ? rest : { ...rest, matchups: matchups.map(sanitizeMatchup) };
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
		DEFINE FIELD OVERWRITE matchups[*].winner  ON TABLE gameday TYPE option<string> ASSERT $value == NONE OR $value INSIDE ['player1', 'player2'];
		DEFINE FIELD OVERWRITE matchups[*].score   ON TABLE gameday TYPE option<string>;
		DEFINE FIELD OVERWRITE matchups[*].replayId ON TABLE gameday TYPE option<string>;
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
