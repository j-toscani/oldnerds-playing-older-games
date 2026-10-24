import type { AppType } from '@onog/api';
import { hc } from 'hono/client';
import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';

// Created per call: `process.env` only exists on the server, where these
// server functions run, so the client must not be built at module load.
function getApiClient() {
	return hc<AppType>(process.env.API_URL || 'http://localhost:4001');
}

export const fetchCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
	const request = getRequest();
	const cookie = request.headers.get('cookie') ?? '';

	try {
		const response = await getApiClient().api.auth.me.$get(undefined, {
			headers: { cookie },
		});

		if (!response.ok) return null;

		const { user } = await response.json();
		return user;
	} catch {
		return null;
	}
});

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
	const response = await getApiClient().api.auth.logout.$post();

	// The API owns the cookie attributes (domain, secure, ...), so its
	// `Set-Cookie` headers are forwarded to the browser as they are. This keeps
	// the frontend in sync with whatever origin the API is configured for.
	const setCookieHeaders = response.headers.getSetCookie();
	if (setCookieHeaders.length > 0) {
		setResponseHeader('Set-Cookie', setCookieHeaders);
	}

	throw redirect({ to: '/', search: { players: [] } }); // Nach dem Logout zurück zur Startseite
});
