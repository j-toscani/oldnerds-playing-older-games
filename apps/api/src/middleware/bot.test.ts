import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import { errorHandler } from '../errors';

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
const { requireBot, BOT_SECRET_HEADER } = await import('./bot');

const app = new Hono()
	.get('/bot-only', requireBot, (c) => c.json({ ok: true }))
	.onError(errorHandler);

function requestWith(secret?: string) {
	return app.request('/bot-only', secret ? { headers: { [BOT_SECRET_HEADER]: secret } } : {});
}

test('lets a request with the shared secret through', async () => {
	expect((await requestWith(BOT_API_SECRET)).status).toBe(200);
});

test('rejects a request without the secret', async () => {
	expect((await requestWith()).status).toBe(401);
});

test('rejects a request with a wrong secret', async () => {
	expect((await requestWith('wrong-secret-that-is-at-least-32-chars')).status).toBe(401);
});
