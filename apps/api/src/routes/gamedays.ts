import { Hono } from 'hono';
import { Gameday } from '../models';

export const gamedayRoutes = new Hono()
	.post('/', async (c) => {
		const body = await c.req.json();
		const gameday = await Gameday.create({
			players: body.players ?? [],
			matchups: body.matchups ?? null,
			noBackToBack: body.noBackToBack ?? true,
		});
		return c.json(gameday, 201);
	})
	.get('/:id', async (c) => {
		const gameday = await Gameday.findById(c.req.param('id'));
		if (!gameday) return c.json({ error: 'Gameday not found' }, 404);
		return c.json(gameday);
	})
	.put('/:id', async (c) => {
		const body = await c.req.json();
		const gameday = await Gameday.update(c.req.param('id'), body);
		if (!gameday) return c.json({ error: 'Gameday not found' }, 404);
		return c.json(gameday);
	})
	.delete('/:id', async (c) => {
		await Gameday.remove(c.req.param('id'));
		return c.body(null, 204);
	});
