import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import { config } from './config';
import { getDb } from './db';
import { initSchemas } from './models';
import { gamedayRoutes } from './routes/gamedays';
import { authRoutes } from './routes/auth';

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
	.route('/api/gamedays', gamedayRoutes)
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
	}).use(
		'/api/gamedays/*',
		jwt({ secret: config.JWT_SECRET, cookie: 'onog_token', alg: 'HS256' }),
	);

export type AppType = typeof app;

export default {
	port: config.PORT,
	fetch: app.fetch,
};
