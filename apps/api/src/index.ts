import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config';
import { getDb } from './db';
import { initSchemas } from './models';
import { gamedayRoutes } from './routes/gamedays';

await initSchemas();

const app = new Hono()
	.use('*', cors())
	.route('/api/gamedays', gamedayRoutes)
	.get('/health', async (c) => {
		let dbStatus: string;

		try {
			const db = await getDb();
			await db.health();
			dbStatus = 'connected';
		} catch {
			dbStatus = 'error';
		}

		return c.json({
			status: 'ok',
			service: 'api',
			timestamp: new Date().toISOString(),
			db: dbStatus,
		});
	});

export type AppType = typeof app;

export default {
	port: config.PORT,
	fetch: app.fetch,
};
