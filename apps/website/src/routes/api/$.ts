/// <reference types="node" />
import { createFileRoute } from '@tanstack/react-router';

function getApiUrl(): string {
	return process.env.API_URL || 'http://localhost:5000';
}

async function proxyToApi(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const targetUrl = `${getApiUrl()}${url.pathname}${url.search}`;

	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.set('accept-encoding', 'identity');

	const response = await fetch(targetUrl, {
		method: request.method,
		headers,
		body: request.body,
		// @ts-expect-error duplex is needed for streaming request bodies
		duplex: 'half',
		redirect: 'manual',
	});

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}

export const Route = createFileRoute('/api/$')({
	server: {
		handlers: {
			GET: async ({ request }) => proxyToApi(request),
			POST: async ({ request }) => proxyToApi(request),
			PUT: async ({ request }) => proxyToApi(request),
			PATCH: async ({ request }) => proxyToApi(request),
			DELETE: async ({ request }) => proxyToApi(request),
		},
	},
});
