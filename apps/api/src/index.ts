import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config';
import { getDb } from './db';
import { errorHandler } from './errors';
import { initSchemas } from './models';
import { authRoutes } from './routes/auth';
import { botMatchRoutes } from './routes/bot-matches';

await initSchemas();

const app = new Hono()
	.use('*', logger())
	.use(
		'*',
		cors({
			origin: config.ALLOWED_ORIGIN,
			credentials: true,
		}),
	)
	.route('/api/auth', authRoutes)
	.route('/api/bot/matches', botMatchRoutes)
	.get('/health', async (c) => {
		let dbStatus: string;

		try {
			const db = await getDb();
			await db.ready;
			dbStatus = 'connected';
		} catch (e) {
			dbStatus = 'error';
		}

		return c.json({
			status: 'ok',
			service: 'api',
			timestamp: new Date().toISOString(),
			db: dbStatus,
		});
	})
	.onError(errorHandler);

export type AppType = typeof app;

export default {
	port: config.PORT,
	fetch: app.fetch,
};
