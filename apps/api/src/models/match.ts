import { RecordId, Table } from 'surrealdb';
import type { MatchData, MatchEvent, MatchStatus } from '@onog/shared';
import type { Model } from './types';
import { getDb } from '../db';
import { toEventContent } from './match-event';

type MatchRecord = Omit<MatchData, 'id' | 'winnerId' | 'createdAt' | 'updatedAt' | 'finishedAt'> & {
	id: RecordId;
	winnerId?: string;
	createdAt: Date;
	updatedAt: Date;
	finishedAt?: Date;
};

function toResponse(record: MatchRecord): MatchData {
	return {
		id: record.id.id as string,
		participants: record.participants,
		format: record.format,
		mapPool: record.mapPool,
		vetoStarterId: record.vetoStarterId,
		status: record.status,
		version: record.version,
		// SurrealDB stores an absent optional field as NONE, which the SDK reads
		// back as `undefined`. Normalize to `null` to honor the shared contract.
		winnerId: record.winnerId ?? null,
		guildId: record.guildId,
		channelId: record.channelId,
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
		finishedAt: record.finishedAt?.toISOString() ?? null,
	};
}

/** What an action changes on the match itself; `null` clears an optional field */
export type MatchPatch = {
	status: MatchStatus;
	winnerId: string | null;
	finishedAt: Date | null;
};

/** The event an action writes: a new event, or marking an existing one as undone */
export type MatchEventWrite =
	| { kind: 'create'; event: Pick<MatchEvent, 'type' | 'map' | 'playerId' | 'actorId'> }
	| { kind: 'undo'; eventId: string; actorId: string };

/** Thrown by `commit` when the match changed since the caller read it */
export class StaleMatchError extends Error {
	constructor() {
		super('Match changed since it was read');
	}
}

interface MatchModel extends Model<MatchData> {
	/**
	 * Applies an action atomically: bumps the version only if it still equals
	 * `expectedVersion`, and writes the event in the same transaction.
	 */
	commit(
		id: string,
		expectedVersion: number,
		patch: MatchPatch,
		write: MatchEventWrite | null,
		now: Date,
	): Promise<void>;
}

// `option<...>` fields reject NULL; `undefined` is sent as NONE, which clears them
const COMMIT_MATCH = `
	LET $updated = (UPDATE $match SET
		version = $version,
		status = $status,
		winnerId = $winnerId,
		finishedAt = $finishedAt,
		updatedAt = $now
	WHERE version = $expectedVersion);
	IF array::len($updated) = 0 { THROW "stale" };
`;

export const Match: MatchModel = {
	schema: `
		DEFINE TABLE OVERWRITE match SCHEMAFULL;
		DEFINE FIELD OVERWRITE participants           ON TABLE match TYPE array<object>;
		DEFINE FIELD OVERWRITE participants[*].discordId ON TABLE match TYPE string;
		DEFINE FIELD OVERWRITE participants[*].name   ON TABLE match TYPE string;
		DEFINE FIELD OVERWRITE participants[*].role   ON TABLE match TYPE string ASSERT $value IN ['player', 'organizer'];
		DEFINE FIELD OVERWRITE format                 ON TABLE match TYPE string ASSERT $value IN ['bo3', 'bo5', 'bo7'];
		DEFINE FIELD OVERWRITE mapPool                ON TABLE match TYPE array<string>;
		DEFINE FIELD OVERWRITE vetoStarterId          ON TABLE match TYPE string;
		DEFINE FIELD OVERWRITE status                 ON TABLE match TYPE string ASSERT $value IN ['veto', 'pick', 'playing', 'finished', 'aborted'];
		DEFINE FIELD OVERWRITE version                ON TABLE match TYPE int;
		DEFINE FIELD OVERWRITE winnerId               ON TABLE match TYPE option<string>;
		DEFINE FIELD OVERWRITE guildId                ON TABLE match TYPE string;
		DEFINE FIELD OVERWRITE channelId              ON TABLE match TYPE string;
		DEFINE FIELD OVERWRITE createdAt              ON TABLE match TYPE datetime;
		DEFINE FIELD OVERWRITE updatedAt              ON TABLE match TYPE datetime;
		DEFINE FIELD OVERWRITE finishedAt             ON TABLE match TYPE option<datetime>;
	`,

	async create({ winnerId, finishedAt, createdAt, updatedAt, ...data }) {
		const db = await getDb();
		const record = await db.create<MatchRecord>(new Table('match')).content({
			...data,
			...(winnerId !== null && { winnerId }),
			...(finishedAt !== null && { finishedAt: new Date(finishedAt) }),
			createdAt: new Date(createdAt),
			updatedAt: new Date(updatedAt),
		});
		// create with Table returns an array
		const created = Array.isArray(record) ? record[0] : record;
		return toResponse(created);
	},

	async findById(id) {
		const db = await getDb();
		try {
			const record = await db.select<MatchRecord>(new RecordId('match', id));
			return record ? toResponse(record) : null;
		} catch {
			return null;
		}
	},

	async find() {
		const db = await getDb();
		const records = await db.select<MatchRecord>(new Table('match'));
		return records.map(toResponse);
	},

	async remove(id) {
		const db = await getDb();
		await db.delete(new RecordId('match', id));
	},

	async commit(id, expectedVersion, patch, write, now) {
		const db = await getDb();
		const version = expectedVersion + 1;
		const match = new RecordId('match', id);

		let eventStatement = '';
		const bindings: Record<string, unknown> = {
			match,
			expectedVersion,
			version,
			status: patch.status,
			winnerId: patch.winnerId ?? undefined,
			finishedAt: patch.finishedAt ?? undefined,
			now,
		};

		if (write?.kind === 'create') {
			eventStatement = 'CREATE match_event CONTENT $event;';
			bindings.event = toEventContent({ ...write.event, matchId: id, seq: version, createdAt: now });
		} else if (write?.kind === 'undo') {
			eventStatement = 'UPDATE $event SET undoneAt = $now, undoneBy = $undoneBy;';
			bindings.event = new RecordId('match_event', write.eventId);
			bindings.undoneBy = write.actorId;
		}

		try {
			await db
				.query(`BEGIN TRANSACTION; ${COMMIT_MATCH} ${eventStatement} COMMIT TRANSACTION;`, bindings)
				.collect();
		} catch (error) {
			// Lost the race: either our THROW or a transaction conflict with the
			// concurrent writer. Re-reading tells both apart from real failures.
			const current = await Match.findById(id);
			if (current && current.version !== expectedVersion) throw new StaleMatchError();
			throw error;
		}
	},
};
