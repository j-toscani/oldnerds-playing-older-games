import path from 'node:path';
import handler from '@tanstack/react-start/server-entry';

const clientDir = path.resolve(import.meta.dir, '../client');

const server = Bun.serve({
	port: Number(process.env.PORT) || 3000,
	async fetch(request) {
		const url = new URL(request.url);

		// Serve static files from the client build output
		if (url.pathname !== '/') {
			const filePath = path.join(clientDir, url.pathname);
			const file = Bun.file(filePath);
			if (await file.exists()) return new Response(file);
		}

		// All other requests → TanStack Start SSR handler
		return handler.fetch(request);
	},
});

console.log(`Server running on http://localhost:${server.port}`);
