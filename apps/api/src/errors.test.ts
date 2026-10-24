import { expect, test } from 'bun:test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ApiError, errorHandler } from './errors';

function respondTo(thrown: unknown) {
	const app = new Hono()
		.get('/', () => {
			throw thrown;
		})
		.onError(errorHandler);
	return app.request('/');
}

test('answers an ApiError with its status, code and message', async () => {
	const response = await respondTo(ApiError.notFound('Match m1 not found'));

	expect(response.status).toBe(404);
	expect(await response.json()).toEqual({
		error: { code: 'not_found', message: 'Match m1 not found' },
	});
});

test('passes details to the client but keeps the cause and stack out', async () => {
	const cause = new Error('connection reset');
	const response = await respondTo(ApiError.conflict('Stale', { details: { version: 3 }, cause }));

	expect(response.status).toBe(409);
	expect(await response.json()).toEqual({
		error: { code: 'conflict', message: 'Stale', details: { version: 3 } },
	});
});

test('answers an unknown error with a generic 500', async () => {
	const response = await respondTo(new Error('secret internals'));

	expect(response.status).toBe(500);
	expect(await response.json()).toEqual({
		error: { code: 'internal', message: 'Internal Server Error' },
	});
});

test("keeps Hono's own HTTPException responses", async () => {
	const response = await respondTo(new HTTPException(413, { message: 'Payload Too Large' }));

	expect(response.status).toBe(413);
	expect(await response.text()).toBe('Payload Too Large');
});

test('the stack starts at the throwing code, not at the factory', () => {
	const error = ApiError.forbidden('Nope');

	expect(error.stack).not.toContain('ApiError.forbidden');
	expect(error.stack).not.toContain('at forbidden');
});

test('prints code, status, message and cause when logged', () => {
	const error = ApiError.upstream('Discord down', { cause: new Error('fetch failed') });
	const printed = Bun.inspect(error);

	expect(printed).toStartWith('ApiError [upstream_failed 502]: Discord down\n');
	expect(printed).toContain('Caused by: ');
	expect(printed).toContain('fetch failed');
});
