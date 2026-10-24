import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { ApiErrorCode, LADDER_MAPS_1V1, type MatchData, type MatchState } from '@onog/shared';
import { ApiError } from '../errors';
import { requireBot } from '../middleware/bot';
import { Match, StaleMatchError } from '../models/match';
import { MatchEvents } from '../models/match-event';
import { deriveMatchState, planAction, type MatchActionError } from '../match/rules';

const personSchema = z.object({
	discordId: z.string().min(1),
	name: z.string().min(1),
});

const createMatchSchema = z
	.object({
		players: z.tuple([personSchema, personSchema]),
		organizer: personSchema,
		format: z.enum(['bo3', 'bo5', 'bo7']),
		guildId: z.string().min(1),
		channelId: z.string().min(1),
	})
	.refine(({ players: [a, b] }) => a.discordId !== b.discordId, {
		message: 'A match needs two different players',
	});

const actionSchema = z.object({
	actorId: z.string().min(1),
	expectedVersion: z.number().int().nonnegative(),
	action: z.discriminatedUnion('type', [
		z.object({ type: z.literal('veto'), map: z.string().min(1) }),
		z.object({ type: z.literal('pick'), map: z.string().min(1) }),
		z.object({ type: z.literal('result'), winnerId: z.string().min(1) }),
		z.object({ type: z.literal('undo') }),
		z.object({ type: z.literal('abort') }),
	]),
});

/** Validates a JSON body with zod; the parsed type flows into the typed client */
function jsonBody<T>(schema: z.ZodType<T>) {
	return validator('json', (value, c) => {
		const result = schema.safeParse(value);
		if (!result.success) {
			throw ApiError.badRequest(`Invalid request body: ${z.prettifyError(result.error)}`, {
				details: { issues: result.error.issues },
			});
		}
		return result.data;
	});
}

type MatchRejection = MatchActionError | 'stale';

const REJECTIONS = {
	forbidden: { code: ApiErrorCode.Forbidden, message: 'The actor may not do this in this match' },
	not_your_turn: { code: ApiErrorCode.Forbidden, message: "It is the other player's turn" },
	invalid: {
		code: ApiErrorCode.Conflict,
		message: 'The action does not fit the current phase or map',
	},
	closed: { code: ApiErrorCode.Conflict, message: 'The match is already closed' },
	expired: {
		code: ApiErrorCode.Conflict,
		message: 'The match expired after 24 hours without activity',
	},
	stale: { code: ApiErrorCode.Conflict, message: 'The match changed since the board was rendered' },
} as const satisfies Record<MatchRejection, { code: ApiErrorCode; message: string }>;

/** The bot picks its message by `reason` and keeps the board in sync with `state` */
function rejectAction(reason: MatchRejection, state: MatchState) {
	const { code, message } = REJECTIONS[reason];
	return new ApiError(code, message, { details: { reason, state } });
}

const OPEN_STATUSES: MatchData['status'][] = ['veto', 'pick', 'playing'];

/** Endpoints for the Discord bot's /match command */
export const botMatchRoutes = new Hono()
	.use('*', requireBot)
	.post('/', jsonBody(createMatchSchema), async (c) => {
		const { players, organizer, format, guildId, channelId } = c.req.valid('json');
		const now = new Date().toISOString();

		const match = await Match.create({
			participants: [
				{ ...players[0], role: 'player' },
				{ ...players[1], role: 'player' },
				{ ...organizer, role: 'organizer' },
			],
			format,
			mapPool: [...LADDER_MAPS_1V1],
			vetoStarterId: players[Math.random() < 0.5 ? 0 : 1].discordId,
			status: 'veto',
			version: 0,
			winnerId: null,
			guildId,
			channelId,
			createdAt: now,
			updatedAt: now,
			finishedAt: null,
		});

		return c.json({ state: deriveMatchState(match, [], new Date()) }, 201);
	})
	.post('/:id/actions', jsonBody(actionSchema), async (c) => {
		const { actorId, expectedVersion, action } = c.req.valid('json');
		const now = new Date();

		const match = await Match.findById(c.req.param('id'));
		if (!match) throw ApiError.notFound(`Match ${c.req.param('id')} not found`);

		const events = await MatchEvents.findByMatch(match.id);
		const current = deriveMatchState(match, events, now);
		if (match.version !== expectedVersion) throw rejectAction('stale', current);

		const plan = planAction(match, events, actorId, action, now);
		if (!plan.ok) {
			// The timeout is applied lazily: the first click after it stores the abort
			if (plan.error === 'expired' && OPEN_STATUSES.includes(match.status)) {
				await Match.commit(
					match.id,
					match.version,
					{ status: 'aborted', winnerId: null, finishedAt: now },
					null,
					now,
				).catch((error) => {
					if (!(error instanceof StaleMatchError)) throw error;
				});
			}
			throw rejectAction(plan.error, current);
		}

		const { next } = plan;
		const ended = next.phase === 'finished' || next.phase === 'aborted';
		try {
			await Match.commit(
				match.id,
				match.version,
				{ status: next.phase, winnerId: next.winnerId, finishedAt: ended ? now : null },
				plan.write,
				now,
			);
		} catch (error) {
			if (error instanceof StaleMatchError) throw rejectAction('stale', current);
			throw error;
		}

		return c.json({ state: next }, 200);
	});
