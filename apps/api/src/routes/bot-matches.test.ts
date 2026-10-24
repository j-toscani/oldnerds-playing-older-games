import { beforeEach, expect, mock, test } from 'bun:test';
import type { MatchData, MatchEvent } from '@onog/shared';
import type { MatchEventWrite, MatchPatch } from '../models/match';

const BOT_API_SECRET = 'bot-secret-that-is-at-least-32-chars';

// `config` validates the environment on import, so it has to be set first
Object.assign(process.env, {
	DISCORD_CLIENT_ID: 'client-id',
	DISCORD_CLIENT_SECRET: 'client-secret',
	DISCORD_REDIRECT_URI: 'http://localhost:4001/api/auth/discord/callback',
	DISCORD_GUILD_ID: 'guild-id',
	JWT_SECRET: 'test-secret-that-is-at-least-32-chars',
	BOT_API_SECRET,
});

// In-memory stand-ins for the SurrealDB models; `commit` keeps the version guard
let matches: Map<string, MatchData>;
let events: MatchEvent[];

class StaleMatchError extends Error {}

mock.module('../models/match', () => ({
	StaleMatchError,
	Match: {
		async create(data: Omit<MatchData, 'id'>) {
			const match = { ...data, id: `m${matches.size + 1}` };
			matches.set(match.id, match);
			return match;
		},
		async findById(id: string) {
			return matches.get(id) ?? null;
		},
		async commit(
			id: string,
			expectedVersion: number,
			patch: MatchPatch,
			write: MatchEventWrite | null,
			now: Date,
		) {
			const match = matches.get(id)!;
			if (match.version !== expectedVersion) throw new StaleMatchError();
			const version = expectedVersion + 1;
			matches.set(id, {
				...match,
				version,
				status: patch.status,
				winnerId: patch.winnerId,
				finishedAt: patch.finishedAt?.toISOString() ?? null,
				updatedAt: now.toISOString(),
			});
			if (write?.kind === 'create') {
				events.push({
					...write.event,
					id: `e${version}`,
					matchId: id,
					seq: version,
					undoneAt: null,
					undoneBy: null,
					createdAt: now.toISOString(),
				});
			}
		},
	},
}));
mock.module('../models/match-event', () => ({
	MatchEvents: {
		async findByMatch(matchId: string) {
			return events.filter((e) => e.matchId === matchId);
		},
	},
}));

const { botMatchRoutes } = await import('./bot-matches');

beforeEach(() => {
	matches = new Map();
	events = [];
});

function post(path: string, body: unknown) {
	return botMatchRoutes.request(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': BOT_API_SECRET },
		body: JSON.stringify(body),
	});
}

const createBody = {
	players: [
		{ discordId: '1', name: 'Tick' },
		{ discordId: '2', name: 'Trick' },
	],
	organizer: { discordId: '3', name: 'Gustav' },
	format: 'bo3',
	guildId: 'g',
	channelId: 'c',
};

test('creates a match in the veto phase', async () => {
	const response = await post('/', createBody);
	expect(response.status).toBe(201);

	const { state } = await response.json();
	expect(state.phase).toBe('veto');
	expect(state.remainingMaps).toHaveLength(9);
	expect(['1', '2']).toContain(state.turnId);
});

test('rejects a match with the same player twice', async () => {
	const response = await post('/', { ...createBody, players: [createBody.players[0], createBody.players[0]] });
	expect(response.status).toBe(400);
});

test('rejects an invalid action body', async () => {
	await post('/', createBody);
	const response = await post('/m1/actions', { actorId: '1', expectedVersion: 0, action: { type: 'dance' } });
	expect(response.status).toBe(400);
});

test('of two clicks on the same version only the first one counts', async () => {
	const { state } = await (await post('/', createBody)).json();
	const map = state.remainingMaps[0];
	const click = () =>
		post('/m1/actions', { actorId: '3', expectedVersion: 0, action: { type: 'veto', map } });

	const responses = await Promise.all([click(), click()]);

	expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
	expect(events).toHaveLength(1);
});

test('reports a rule violation with the current state', async () => {
	const { state } = await (await post('/', createBody)).json();
	const response = await post('/m1/actions', {
		actorId: '9',
		expectedVersion: 0,
		action: { type: 'veto', map: state.remainingMaps[0] },
	});

	expect(response.status).toBe(403);
	expect(await response.json()).toMatchObject({ error: 'forbidden', state: { version: 0 } });
});

test('rejects requests without the bot secret', async () => {
	const response = await botMatchRoutes.request('/', { method: 'POST', body: '{}' });
	expect(response.status).toBe(401);
});
