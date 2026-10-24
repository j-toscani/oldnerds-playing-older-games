import { RecordId, Table } from 'surrealdb';
import type { MatchEvent } from '@onog/shared';
import type { Model } from './types';
import { getDb } from '../db';

type MatchEventRecord = Omit<
	MatchEvent,
	'id' | 'matchId' | 'map' | 'playerId' | 'undoneAt' | 'undoneBy' | 'createdAt'
> & {
	id: RecordId;
	match: RecordId;
	map?: string;
	playerId?: string;
	undoneAt?: Date;
	undoneBy?: string;
	createdAt: Date;
};

function toResponse(record: MatchEventRecord): MatchEvent {
	return {
		id: record.id.id as string,
		matchId: record.match.id as string,
		seq: record.seq,
		type: record.type,
		// NONE comes back as `undefined`; the shared contract uses `null`
		map: record.map ?? null,
		playerId: record.playerId ?? null,
		actorId: record.actorId,
		undoneAt: record.undoneAt?.toISOString() ?? null,
		undoneBy: record.undoneBy ?? null,
		createdAt: record.createdAt.toISOString(),
	};
}

/**
 * Builds the record content for an event. `option<...>` fields reject a JS
 * `null` (SurrealDB NULL), so absent values are left out and stored as NONE.
 */
export function toEventContent(
	event: Pick<MatchEvent, 'matchId' | 'seq' | 'type' | 'map' | 'playerId' | 'actorId'> & {
		createdAt: Date;
		undoneAt?: string | null;
		undoneBy?: string | null;
	},
): Record<string, unknown> {
	const { matchId, map, playerId, undoneAt, undoneBy, ...rest } = event;
	return {
		...rest,
		match: new RecordId('match', matchId),
		...(map !== null && { map }),
		...(playerId !== null && { playerId }),
		...(undoneAt != null && { undoneAt: new Date(undoneAt) }),
		...(undoneBy != null && { undoneBy }),
	};
}

interface MatchEventModel extends Model<MatchEvent> {
	/** All events of a match, oldest first, including undone ones */
	findByMatch(matchId: string): Promise<MatchEvent[]>;
}

export const MatchEvents: MatchEventModel = {
	schema: `
		DEFINE TABLE OVERWRITE match_event SCHEMAFULL;
		DEFINE FIELD OVERWRITE match     ON TABLE match_event TYPE record<match>;
		DEFINE FIELD OVERWRITE seq       ON TABLE match_event TYPE int;
		DEFINE FIELD OVERWRITE type      ON TABLE match_event TYPE string ASSERT $value IN ['veto', 'pick', 'result', 'abort'];
		DEFINE FIELD OVERWRITE map       ON TABLE match_event TYPE option<string>;
		DEFINE FIELD OVERWRITE playerId  ON TABLE match_event TYPE option<string>;
		DEFINE FIELD OVERWRITE actorId   ON TABLE match_event TYPE string;
		DEFINE FIELD OVERWRITE undoneAt  ON TABLE match_event TYPE option<datetime>;
		DEFINE FIELD OVERWRITE undoneBy  ON TABLE match_event TYPE option<string>;
		DEFINE FIELD OVERWRITE createdAt ON TABLE match_event TYPE datetime;
		DEFINE INDEX OVERWRITE match_event_seq ON TABLE match_event FIELDS match, seq UNIQUE;
	`,

	async create(data) {
		const db = await getDb();
		const record = await db
			.create<MatchEventRecord>(new Table('match_event'))
			.content(toEventContent({ ...data, createdAt: new Date(data.createdAt) }));
		// create with Table returns an array
		const created = Array.isArray(record) ? record[0] : record;
		return toResponse(created);
	},

	async findById(id) {
		const db = await getDb();
		try {
			const record = await db.select<MatchEventRecord>(new RecordId('match_event', id));
			return record ? toResponse(record) : null;
		} catch {
			return null;
		}
	},

	async find() {
		const db = await getDb();
		const records = await db.select<MatchEventRecord>(new Table('match_event'));
		return records.map(toResponse);
	},

	async remove(id) {
		const db = await getDb();
		await db.delete(new RecordId('match_event', id));
	},

	async findByMatch(matchId) {
		const db = await getDb();
		const [records] = await db
			.query('SELECT * FROM match_event WHERE match = $match ORDER BY seq', {
				match: new RecordId('match', matchId),
			})
			.collect<[MatchEventRecord[]]>();
		return records.map(toResponse);
	},
};
