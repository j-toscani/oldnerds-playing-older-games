import { hc } from 'hono/client';
import type { AppType } from '@onog/api';

/**
 * Typed RPC client for the ONOG API.
 *
 * The types are derived from the API's `AppType` (`typeof app`) via Hono's `hc`,
 * so the client mirrors the real routes and their response shapes — no
 * hand-written contract. The `@onog/api` dependency is **type-only** (`import
 * type` + devDependency): it is fully erased at build time, so nothing from the
 * server ships in the browser bundle.
 */
export function createApiClient(baseUrl: string, headers?: Record<string, string>) {
	return hc<AppType>(baseUrl, {
		headers,
		fetch: (input: RequestInfo | URL, init?: RequestInit) =>
			fetch(input, { ...init, credentials: 'include' }),
	});
}

/**
 * Browser client: requests go same-origin so they pass through the `/api` proxy
 * (`src/routes/api/$.ts`), which forwards the `onog_token` cookie to the API.
 *
 * Server-side code cannot use this one — it has neither an origin to talk to nor
 * an ambient cookie. Build a client with `createApiClient` there instead and pass
 * the incoming `cookie` header explicitly (see `lib/gameday.ts`).
 */
const baseUrl = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

export const api = createApiClient(baseUrl);
