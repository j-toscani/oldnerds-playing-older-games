import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { z } from 'zod';
import type { User } from '@onog/shared';
import { config } from '../config';

export const TOKEN_COOKIE = 'onog_token';

/**
 * The claims the login callback signs, mapped to the shared `User`. `verify`
 * only checks the signature, so this guards against tokens with an unexpected shape.
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

async function readUser(token: string): Promise<User | null> {
	try {
		const payload = await verify(token, config.JWT_SECRET, 'HS256');
		const claims = userClaimsSchema.safeParse(payload);
		return claims.success ? claims.data : null;
	} catch {
		// Invalid signature or expired token: the request is simply unauthenticated
		return null;
	}
}

/** Rejects requests without a valid login cookie; handlers read the user from `c.var.user` */
export const requireAuth = createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
	const token = getCookie(c, TOKEN_COOKIE);
	const user = token ? await readUser(token) : null;
	if (!user) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	c.set('user', user);
	await next();
});
