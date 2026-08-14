import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { Gameday } from '../models';
import { broadcast } from '../lib/events';
import { openGamedayStream } from '../lib/sse';

export const gamedayRoutes = new Hono()
	.get('/', async (c) => {
		const gamedays = await Gameday.find();
		return c.json(gamedays);
	})
	.post('/', async (c) => {
		const body = await c.req.json();
		const gameday = await Gameday.create({
			players: body.players ?? [],
			matchups: body.matchups ?? null,
			noBackToBack: body.noBackToBack ?? true,
		});
		return c.json(gameday, 201);
	})
	// Generic Server-Sent-Events channel for a single gameday. The SSE lifecycle
	// (subscribe, heartbeat, teardown) lives in `openGamedayStream`. Registered
	// before `/:id` so it isn't shadowed.
	.get('/:id/events', (c) =>
		streamSSE(c, (stream) => openGamedayStream(stream, c.req.param('id'))),
	)
	.get('/:id', async (c) => {
		const gameday = await Gameday.findById(c.req.param('id'));
		if (!gameday) return c.json({ error: 'Gameday not found' }, 404);
		return c.json(gameday);
	})
	.put('/:id', async (c) => {
		const body = await c.req.json();
		const gameday = await Gameday.update(c.req.param('id'), body);
		if (!gameday) return c.json({ error: 'Gameday not found' }, 404);
		// Notify open live-update clients. `matchups`/results feed both standings
		// and per-matchup views, so emit both event types with the fresh gameday.
		broadcast(gameday.id, { type: 'matchup-updated', payload: gameday });
		broadcast(gameday.id, { type: 'standings-updated', payload: gameday });
		return c.json(gameday);
	})
	.delete('/:id', async (c) => {
		await Gameday.remove(c.req.param('id'));
		return c.body(null, 204);
	});
