import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';
import { LADDER_MAPS_1V1, type MatchData } from '@onog/shared';
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
			return c.json({ error: 'invalid_body' as const, issues: result.error.issues }, 400);
		}
		return result.data;
	});
}

const ERROR_STATUS = {
	forbidden: 403,
	not_your_turn: 403,
	invalid: 422,
	closed: 422,
	expired: 422,
} as const satisfies Record<MatchActionError, number>;

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
		if (!match) return c.json({ error: 'not_found' as const }, 404);

		const events = await MatchEvents.findByMatch(match.id);
		const current = deriveMatchState(match, events, now);
		if (match.version !== expectedVersion) {
			return c.json({ error: 'stale' as const, state: current }, 409);
		}

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
			return c.json({ error: plan.error, state: current }, ERROR_STATUS[plan.error]);
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
			if (error instanceof StaleMatchError) {
				return c.json({ error: 'stale' as const, state: current }, 409);
			}
			throw error;
		}

		return c.json({ state: next }, 200);
	});
