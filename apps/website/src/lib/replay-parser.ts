import type { ParsedReplay } from '@onog/shared';

type ParseFn = (bytes: Uint8Array) => ParsedReplay;

let parserPromise: Promise<ParseFn> | null = null;

/**
 * Loads the WASM replay parser on first use and caches it. Client-only: the
 * `import.meta.env.SSR` branch is constant-folded by Vite, so the server bundle
 * contains neither the glue code nor the `.wasm` asset. The glue resolves the
 * `.wasm` file via `new URL(..., import.meta.url)`, which Vite handles natively
 * — no WASM plugin needed.
 */
export function loadReplayParser(): Promise<ParseFn> {
	if (import.meta.env.SSR) {
		return Promise.reject(new Error('The replay parser is client-only'));
	}

	parserPromise ??= import('@onog/replay-parser')
		.then(async (module) => {
			await module.default();
			return (bytes: Uint8Array) => module.parse(bytes) as ParsedReplay;
		})
		.catch((error: unknown) => {
			// Allow a retry after e.g. a flaky connection instead of caching the failure
			parserPromise = null;
			throw error;
		});

	return parserPromise;
}
