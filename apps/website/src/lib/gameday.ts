import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { notFound, redirect } from '@tanstack/react-router';
import { createApiClient } from './api';

/**
 * Load a gameday snapshot for a route loader.
 *
 * Runs on the server so the request's `onog_token` cookie can be forwarded to
 * the API — the browser client in `lib/api.ts` cannot be reused here, because a
 * loader also executes during SSR, where there is no `window.location.origin`
 * and no automatic cookie on an outgoing `fetch`. The RPC typing is kept by
 * building a `hc<AppType>` client against the API's own origin instead of the
 * same-origin `/api` proxy.
 */
export const fetchGameday = createServerFn({ method: 'GET' })
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		const cookie = getRequest().headers.get('cookie') ?? '';
		const client = createApiClient(process.env.API_URL || 'http://localhost:4001', { cookie });

		const res = await client.api.gamedays[':id'].$get({ param: { id } });

		// Widened on purpose: the RPC client types `status` as a union of the
		// statuses the *route* declares, and the 401 comes from the JWT
		// middleware — which that type doesn't know about.
		const status: number = res.status;
		// Covers a session that expired while the page was open: every resync runs
		// through here, so the redirect happens instead of a silently stale view.
		if (status === 401) throw redirect({ to: '/', search: { players: [] } });
		if (status === 404) throw notFound();
		if (!res.ok) throw new Error(`Gameday konnte nicht geladen werden (HTTP ${status})`);

		return res.json();
	});
