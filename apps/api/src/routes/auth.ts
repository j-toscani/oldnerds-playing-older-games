import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { config } from '../config';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/v10/users/@me';
const DISCORD_GUILDS_URL = 'https://discord.com/api/v10/users/@me/guilds';

const TOKEN_COOKIE = 'ong_token';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage

export const authRoutes = new Hono()

	// ─── Redirect zu Discord OAuth ───────────────────────────
	.get('/discord', (c) => {
		const params = new URLSearchParams({
			client_id: config.DISCORD_CLIENT_ID,
			redirect_uri: config.DISCORD_REDIRECT_URI,
			response_type: 'code',
			scope: 'identify guilds',
		});

		return c.redirect(`${DISCORD_AUTHORIZE_URL}?${params.toString()}`);
	})

	// ─── Discord Callback ────────────────────────────────────
	.get('/discord/callback', async (c) => {
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

		const tokenData = (await tokenResponse.json()) as { access_token: string };
		const accessToken = tokenData.access_token;

		// 2. User-Info von Discord holen
		const userResponse = await fetch(DISCORD_USER_URL, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!userResponse.ok) {
			return c.json({ error: 'Failed to fetch Discord user' }, 400);
		}

		const discordUser = (await userResponse.json()) as {
			id: string;
			username: string;
			avatar: string | null;
		};

		// 3. Guild-Mitgliedschaft prüfen
		const guildsResponse = await fetch(DISCORD_GUILDS_URL, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!guildsResponse.ok) {
			return c.json({ error: 'Failed to fetch guilds' }, 400);
		}

		const guilds = (await guildsResponse.json()) as { id: string }[];
		const isMember = guilds.some(
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
		setCookie(c, TOKEN_COOKIE, jwt, {
			httpOnly: true,
			secure: true,
			sameSite: 'Lax',
			domain: 'onog.tosco.dev',
			path: '/',
			maxAge: TOKEN_MAX_AGE,
		});

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
			return c.json({
				user: {
					discordId: payload.sub,
					username: payload.username,
					avatar: payload.avatar,
				},
			});
		} catch {
			return c.json({ user: null }, 401);
		}
	})

	// ─── Logout ──────────────────────────────────────────────
	.post('/logout', (c) => {
		deleteCookie(c, TOKEN_COOKIE, {
			httpOnly: true,
			secure: true,
			sameSite: 'Lax',
			domain: 'onog.tosco.dev',
			path: '/',
		});

		return c.json({ ok: true });
	});
