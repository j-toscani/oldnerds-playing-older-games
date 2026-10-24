import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const JWT_SECRET = 'test-secret-that-is-at-least-32-chars';

// `config` validates the environment on import, so it has to be set first
Object.assign(process.env, {
	DISCORD_CLIENT_ID: 'client-id',
	DISCORD_CLIENT_SECRET: 'client-secret',
	DISCORD_REDIRECT_URI: 'http://localhost:4001/api/auth/discord/callback',
	DISCORD_GUILD_ID: 'guild-id',
	JWT_SECRET,
});
const { requireAuth, TOKEN_COOKIE } = await import('./auth');

const app = new Hono().get('/protected', requireAuth, (c) => c.json({ user: c.var.user }));

const now = () => Math.floor(Date.now() / 1000);
const validClaims = () => ({ sub: '42', username: 'tick', avatar: null, exp: now() + 60 });

function requestWith(token?: string) {
	return app.request(
		'/protected',
		token ? { headers: { cookie: `${TOKEN_COOKIE}=${token}` } } : {},
	);
}

test('hands the user from a valid token to the handler', async () => {
	const response = await requestWith(await sign(validClaims(), JWT_SECRET));

	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		user: { discordId: '42', username: 'tick', avatar: null },
	});
});

test('rejects a request without a token', async () => {
	expect((await requestWith()).status).toBe(401);
});

test('rejects a token signed with another secret', async () => {
	const token = await sign(validClaims(), 'another-secret-that-is-at-least-32-chars');
	expect((await requestWith(token)).status).toBe(401);
});

test('rejects an expired token', async () => {
	const token = await sign({ ...validClaims(), exp: now() - 60 }, JWT_SECRET);
	expect((await requestWith(token)).status).toBe(401);
});

test('rejects a validly signed token with unexpected claims', async () => {
	const { username: _, ...claims } = validClaims();
	expect((await requestWith(await sign(claims, JWT_SECRET))).status).toBe(401);
});
