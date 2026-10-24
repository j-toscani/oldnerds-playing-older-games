import { createMiddleware } from 'hono/factory';
import { timingSafeEqual } from 'hono/utils/buffer';
import { config } from '../config';

export const BOT_SECRET_HEADER = 'X-Bot-Secret';

/** Lets only the Discord bot through, identified by the secret both services share */
export const requireBot = createMiddleware(async (c, next) => {
	const secret = c.req.header(BOT_SECRET_HEADER);
	if (!secret || !(await timingSafeEqual(secret, config.BOT_API_SECRET))) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	await next();
});
