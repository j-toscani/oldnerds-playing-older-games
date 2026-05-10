import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config';
import { getDb } from './db';

const app = new Hono();

app.use('*', cors());

app.get('/health', async (c) => {
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

export default {
	port: config.PORT,
	fetch: app.fetch,
};
