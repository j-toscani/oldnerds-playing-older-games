import { Hono } from 'hono';
import { cors } from 'hono/cors';
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

const PORT = parseInt(process.env.PORT ?? '5000', 10);

export default {
	port: PORT,
	fetch: app.fetch,
};
