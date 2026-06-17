import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/health')({
	server: {
		handlers: {
			GET: async () => {
				return new Response(
					JSON.stringify({
						status: 'ok',
						service: 'website',
						timestamp: new Date().toISOString(),
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					},
				);
			},
		},
	},
});
