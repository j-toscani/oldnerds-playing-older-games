import { beforeEach, expect, mock, test } from 'bun:test';
import type { MatchState } from '@onog/shared';
import { MessageFlags, ResponseType, type Interaction } from '../discord';
import { buildCustomId } from './custom-id';

// `config` validates the environment on import, so it has to be set first
Object.assign(process.env, {
	DISCORD_APP_KEY: 'key',
	BOT_API_SECRET: 'bot-secret-that-is-at-least-32-chars',
});

const STATE: MatchState = {
	matchId: 'm1',
	version: 0,
	format: 'bo3',
	phase: 'veto',
	players: [
		{ discordId: '1', name: 'Tick', role: 'player' },
		{ discordId: '2', name: 'Trick', role: 'player' },
	],
	organizer: { discordId: '3', name: 'Gustav', role: 'organizer' },
	mapPool: ['A', 'B', 'C'],
	vetoes: [],
	remainingMaps: ['A', 'B', 'C'],
	order: [],
	turnId: '1',
	games: [],
	currentMap: null,
	wins: { '1': 0, '2': 0 },
	winsNeeded: 2,
	winnerId: null,
};

let nextResponse: Response;
const createMatch = mock(async (_: unknown) => nextResponse);
const postAction = mock(async (_: unknown) => nextResponse);

mock.module('../api', () => ({
	api: { api: { bot: { matches: { $post: createMatch, ':id': { actions: { $post: postAction } } } } } },
}));

const { handleMatchCommand, handleMatchButton } = await import('./handlers');

beforeEach(() => {
	createMatch.mockClear();
	postAction.mockClear();
});

const user = (id: string, name: string) => ({ id, username: name });

function command(player1: string, player2: string): Interaction {
	return {
		type: 2,
		guild_id: 'g',
		channel_id: 'c',
		member: { user: user('3', 'gustav'), nick: 'Gustav' },
		data: {
			name: 'match',
			options: [
				{ name: 'player1', type: 6, value: player1 },
				{ name: 'player2', type: 6, value: player2 },
				{ name: 'format', type: 3, value: 'bo3' },
			],
			resolved: { users: { '1': user('1', 'tick'), '2': user('2', 'trick') }, members: { '1': { nick: 'Tick' } } },
		},
	};
}

function click(customId: string, actorId = '1'): Interaction {
	return { type: 3, guild_id: 'g', member: { user: user(actorId, 'x') }, data: { custom_id: customId } };
}

test('/match with the same player twice is rejected without calling the API', async () => {
	const response = await handleMatchCommand(command('1', '1'));

	expect(response).toMatchObject({ type: ResponseType.ChannelMessage, data: { flags: MessageFlags.Ephemeral } });
	expect(createMatch).not.toHaveBeenCalled();
});

test('/match creates the match with display names and posts the board', async () => {
	nextResponse = Response.json({ state: STATE }, { status: 201 });

	const response = await handleMatchCommand(command('1', '2'));

	expect(createMatch.mock.calls[0][0]).toMatchObject({
		json: {
			players: [
				{ discordId: '1', name: 'Tick' },
				{ discordId: '2', name: 'trick' },
			],
			organizer: { discordId: '3', name: 'Gustav' },
			format: 'bo3',
		},
	});
	expect(response.type).toBe(ResponseType.ChannelMessage);
	expect(response.data).toHaveProperty('components');
});

test('a successful click updates the board in place', async () => {
	nextResponse = Response.json({ state: { ...STATE, version: 1 } }, { status: 200 });

	const response = await handleMatchButton(click(buildCustomId(STATE, 'veto', 'A')));

	expect(postAction.mock.calls[0][0]).toEqual({
		param: { id: 'm1' },
		json: { actorId: '1', expectedVersion: 0, action: { type: 'veto', map: 'A' } },
	});
	expect(response.type).toBe(ResponseType.UpdateMessage);
});

test('a rejected click answers only the clicking user', async () => {
	nextResponse = Response.json({ error: 'not_your_turn', state: STATE }, { status: 403 });

	const response = await handleMatchButton(click(buildCustomId(STATE, 'veto', 'A'), '2'));

	expect(response).toEqual({
		type: ResponseType.ChannelMessage,
		data: { content: '⏳ Du bist gerade nicht am Zug.', flags: MessageFlags.Ephemeral },
	});
});

test('a winner button sends a result for that player', async () => {
	nextResponse = Response.json({ state: STATE }, { status: 200 });

	await handleMatchButton(click(buildCustomId(STATE, 'win', '2'), '3'));

	expect(postAction.mock.calls[0][0]).toMatchObject({
		json: { actorId: '3', action: { type: 'result', winnerId: '2' } },
	});
});
