import path from 'node:path';
import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

const entry = createServerEntry({
	fetch(request) {
		return handler.fetch(request);
	},
});

export default entry;

// Production only: start Bun HTTP server with static file serving.
// import.meta.dir is only defined in Bun runtime, not in Vite dev mode.
if (import.meta.dir) {
	const clientDir = path.resolve(import.meta.dir, '../client');

	Bun.serve({
		port: Number(process.env.PORT) || 3000,
		async fetch(request) {
			const url = new URL(request.url);
			if (url.pathname !== '/') {
				const filePath = path.join(clientDir, url.pathname);
				const file = Bun.file(filePath);
				if (await file.exists()) return new Response(file);
			}
			return entry.fetch(request);
		},
	});

	console.log(`Server running on http://localhost:${Number(process.env.PORT) || 3000}`);
}
