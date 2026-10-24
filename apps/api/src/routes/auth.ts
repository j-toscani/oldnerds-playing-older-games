import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import { sign } from 'hono/jwt';
import { z } from 'zod';
import { logger, type LoginErrorReason } from '@onog/shared';
import { config } from '../config';
import { requireAuth, TOKEN_COOKIE } from '../middleware/auth';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/v10/users/@me';
const DISCORD_GUILDS_URL = 'https://discord.com/api/v10/users/@me/guilds';

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

/** The browser is mid-navigation, so failures go to a website page instead of raw JSON */
function redirectToLoginError(c: Context, reason: LoginErrorReason) {
	const url = new URL('/login-error', config.ALLOWED_ORIGIN);
	url.searchParams.set('reason', reason);
	return c.redirect(url.toString());
}

/** Throws a descriptive error for a failed or unexpected Discord response */
async function readDiscordResponse<T>(
	response: Response,
	schema: z.ZodType<T>,
	what: string,
): Promise<T> {
	if (!response.ok) {
		throw new Error(`Discord ${what} request failed with status ${response.status}`);
	}
	const result = schema.safeParse(await response.json());
	if (!result.success) {
		throw new Error(`Unexpected Discord ${what} response: ${z.prettifyError(result.error)}`);
	}
	return result.data;
}

/** Exchanges the authorization code and reads the user plus their guilds from Discord */
async function fetchDiscordIdentity(code: string) {
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
	const { access_token } = await readDiscordResponse(tokenResponse, discordTokenSchema, 'token');

	const headers = { Authorization: `Bearer ${access_token}` };
	const user = await readDiscordResponse(
		await fetch(DISCORD_USER_URL, { headers }),
		discordUserSchema,
		'user',
	);
	const guilds = await readDiscordResponse(
		await fetch(DISCORD_GUILDS_URL, { headers }),
		discordGuildsSchema,
		'guilds',
	);

	return { user, guilds };
}

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
			logger.info('Discord login rejected: invalid OAuth state');
			return redirectToLoginError(c, 'login_failed');
		}

		const code = c.req.query('code');
		if (!code) {
			// Discord sends `error` instead of `code`, e.g. when the user cancels the consent
			logger.info('Discord login aborted:', c.req.query('error') ?? 'missing authorization code');
			return redirectToLoginError(c, 'login_failed');
		}

		let identity: Awaited<ReturnType<typeof fetchDiscordIdentity>>;
		try {
			identity = await fetchDiscordIdentity(code);
		} catch (error) {
			logger.error('Discord login failed:', error instanceof Error ? error.message : error);
			return redirectToLoginError(c, 'login_failed');
		}

		const { user, guilds } = identity;
		if (!guilds.some((guild) => guild.id === config.DISCORD_GUILD_ID)) {
			return redirectToLoginError(c, 'not_a_member');
		}

		const now = Math.floor(Date.now() / 1000);
		const jwt = await sign(
			{
				sub: user.id,
				username: user.username,
				avatar: user.avatar,
				iat: now,
				exp: now + TOKEN_MAX_AGE,
			},
			config.JWT_SECRET,
		);

		setCookie(c, TOKEN_COOKIE, jwt, { ...TOKEN_COOKIE_OPTIONS, maxAge: TOKEN_MAX_AGE });

		return c.redirect(config.ALLOWED_ORIGIN);
	})

	// ─── Aktuellen User abrufen ──────────────────────────────
	.get('/me', requireAuth, (c) => {
		return c.json({ user: c.var.user }, 200);
	})

	// ─── Logout ──────────────────────────────────────────────
	.post('/logout', (c) => {
		deleteCookie(c, TOKEN_COOKIE, TOKEN_COOKIE_OPTIONS);

		return c.json({ ok: true });
	});
