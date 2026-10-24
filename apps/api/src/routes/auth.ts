import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import { sign, verify } from 'hono/jwt';
import { z } from 'zod';
import { logger, type User } from '@onog/shared';
import { config } from '../config';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/v10/users/@me';
const DISCORD_GUILDS_URL = 'https://discord.com/api/v10/users/@me/guilds';

const TOKEN_COOKIE = 'onog_token';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage

// CSRF protection for the OAuth flow: a random value bound to the browser that
// started the login, which Discord echoes back on the callback.
const STATE_COOKIE = 'onog_oauth_state';
const STATE_MAX_AGE = 60 * 10; // 10 minutes to complete the Discord consent

/**
 * The cookie follows the website's origin instead of a fixed domain, so local
 * development on http://localhost gets a working cookie too.
 */
const websiteOrigin = new URL(config.ALLOWED_ORIGIN);
const TOKEN_COOKIE_OPTIONS: CookieOptions = {
	httpOnly: true,
	// Plain http in local development; a `Secure` cookie would be dropped there by some browsers
	secure: websiteOrigin.protocol === 'https:',
	sameSite: 'Lax',
	path: '/',
	// Browsers reject an explicit `localhost` domain; a host-only cookie works there
	...(websiteOrigin.hostname !== 'localhost' && { domain: websiteOrigin.hostname }),
};

// Discord responses are only parsed as far as the callback needs them
const discordTokenSchema = z.object({ access_token: z.string().min(1) });
const discordUserSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(1),
	avatar: z.string().nullable(),
});
const discordGuildsSchema = z.array(z.object({ id: z.string().min(1) }));

/**
 * The claims the callback signs, mapped to the shared `User`. `verify` only
 * checks the signature, so this guards against tokens with an unexpected shape.
 */
const userClaimsSchema = z
	.object({
		sub: z.string().min(1),
		username: z.string().min(1),
		avatar: z.string().nullable(),
	})
	.transform(({ sub, username, avatar }) => ({
		discordId: sub,
		username,
		avatar,
	})) satisfies z.ZodType<User>;

export const authRoutes = new Hono()

	// ─── Redirect zu Discord OAuth ───────────────────────────
	.get('/discord', (c) => {
		const state = crypto.randomUUID();
		setCookie(c, STATE_COOKIE, state, { ...TOKEN_COOKIE_OPTIONS, maxAge: STATE_MAX_AGE });

		const params = new URLSearchParams({
			client_id: config.DISCORD_CLIENT_ID,
			redirect_uri: config.DISCORD_REDIRECT_URI,
			response_type: 'code',
			scope: 'identify guilds',
			state,
		});

		return c.redirect(`${DISCORD_AUTHORIZE_URL}?${params.toString()}`);
	})

	// ─── Discord Callback ────────────────────────────────────
	.get('/discord/callback', async (c) => {
		// The state is single-use: drop the cookie before anything can fail
		const expectedState = getCookie(c, STATE_COOKIE);
		deleteCookie(c, STATE_COOKIE, TOKEN_COOKIE_OPTIONS);

		const state = c.req.query('state');
		if (!expectedState || state !== expectedState) {
			return c.json({ error: 'Invalid OAuth state' }, 400);
		}

		const code = c.req.query('code');
		if (!code) {
			return c.json({ error: 'Missing authorization code' }, 400);
		}

		// 1. Code gegen Access Token tauschen
		const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: config.DISCORD_CLIENT_ID,
				client_secret: config.DISCORD_CLIENT_SECRET,
				grant_type: 'authorization_code',
				code,
				redirect_uri: config.DISCORD_REDIRECT_URI,
			}),
		});

		if (!tokenResponse.ok) {
			return c.json({ error: 'Failed to exchange authorization code' }, 400);
		}

		const tokenData = discordTokenSchema.safeParse(await tokenResponse.json());
		if (!tokenData.success) {
			logger.error('Unexpected Discord token response:', z.prettifyError(tokenData.error));
			return c.json({ error: 'Failed to exchange authorization code' }, 400);
		}
		const accessToken = tokenData.data.access_token;

		// 2. User-Info von Discord holen
		const userResponse = await fetch(DISCORD_USER_URL, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!userResponse.ok) {
			return c.json({ error: 'Failed to fetch Discord user' }, 400);
		}

		const discordUserData = discordUserSchema.safeParse(await userResponse.json());
		if (!discordUserData.success) {
			logger.error('Unexpected Discord user response:', z.prettifyError(discordUserData.error));
			return c.json({ error: 'Failed to fetch Discord user' }, 400);
		}
		const discordUser = discordUserData.data;

		// 3. Guild-Mitgliedschaft prüfen
		const guildsResponse = await fetch(DISCORD_GUILDS_URL, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!guildsResponse.ok) {
			return c.json({ error: 'Failed to fetch guilds' }, 400);
		}

		const guilds = discordGuildsSchema.safeParse(await guildsResponse.json());
		if (!guilds.success) {
			logger.error('Unexpected Discord guilds response:', z.prettifyError(guilds.error));
			return c.json({ error: 'Failed to fetch guilds' }, 400);
		}
		const isMember = guilds.data.some(
			(guild) => guild.id === config.DISCORD_GUILD_ID,
		);

		if (!isMember) {
			return c.redirect(
				`${config.ALLOWED_ORIGIN}?error=not_a_member`,
			);
		}

		// 4. JWT erzeugen
		const now = Math.floor(Date.now() / 1000);
		const jwt = await sign(
			{
				sub: discordUser.id,
				username: discordUser.username,
				avatar: discordUser.avatar,
				iat: now,
				exp: now + TOKEN_MAX_AGE,
			},
			config.JWT_SECRET,
		);

		// 5. Cookie setzen und zurück zur Website
		setCookie(c, TOKEN_COOKIE, jwt, { ...TOKEN_COOKIE_OPTIONS, maxAge: TOKEN_MAX_AGE });

		return c.redirect(config.ALLOWED_ORIGIN);
	})

	// ─── Aktuellen User abrufen ──────────────────────────────
	.get('/me', async (c) => {
		const token = getCookie(c, TOKEN_COOKIE);
		if (!token) {
			return c.json({ user: null }, 401);
		}

		try {
			const payload = await verify(token, config.JWT_SECRET, 'HS256');
			const claims = userClaimsSchema.safeParse(payload);
			if (!claims.success) {
				return c.json({ user: null }, 401);
			}
			return c.json({ user: claims.data }, 200);
		} catch {
			return c.json({ user: null }, 401);
		}
	})

	// ─── Logout ──────────────────────────────────────────────
	.post('/logout', (c) => {
		deleteCookie(c, TOKEN_COOKIE, TOKEN_COOKIE_OPTIONS);

		return c.json({ ok: true });
	});
