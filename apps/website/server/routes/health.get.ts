import { defineEventHandler } from 'h3';

export default defineEventHandler(() => {
	return {
		status: 'ok',
		service: 'website',
		timestamp: new Date().toISOString(),
	};
});
