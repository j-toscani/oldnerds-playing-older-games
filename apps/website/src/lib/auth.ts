import type { User } from '@onog/shared';
import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';

function getRequestUrl(path: string): URL {
	return new URL(path, process.env.API_URL || 'http://localhost:4001');
}

export const fetchCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
	const request = getRequest();
	const apiUrl = getRequestUrl('/api/auth/me');
	const cookie = request.headers.get('cookie') ?? '';

	try {
		const response = await fetch(apiUrl, {
			headers: { cookie },
			credentials: 'include',
		});

		if (!response.ok) return null;

		const data = (await response.json()) as { user: User | null };
		return data.user;
	} catch {
		return null;
	}
});

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
	const url = getRequestUrl('/api/auth/logout');
	const response = await fetch(url, { method: 'POST' });

	// The API owns the cookie attributes (domain, secure, ...), so its
	// `Set-Cookie` headers are forwarded to the browser as they are. This keeps
	// the frontend in sync with whatever origin the API is configured for.
	const setCookieHeaders = response.headers.getSetCookie();
	if (setCookieHeaders.length > 0) {
		setResponseHeader('Set-Cookie', setCookieHeaders);
	}

	throw redirect({ to: '/', search: { players: [] } }); // Nach dem Logout zurück zur Startseite
});
