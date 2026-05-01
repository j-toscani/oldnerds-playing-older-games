import { defineHandler } from 'nitro';

export default defineHandler(async (event) => {
	const body = await event.req.json();

	console.log('=== Discord Interaction Received ===');
	console.log('Type:', body?.type);
	console.log('Full body:', JSON.stringify(body, null, 2));

	// Type 1 = PING (Discord verification handshake)
	if (body?.type === 1) {
		console.log('→ Responding with PONG');
		return { type: 1 };
	}

	// Type 2 = APPLICATION_COMMAND
	if (body?.type === 2) {
		const commandName = body?.data?.name ?? 'unknown';
		const options = body?.data?.options ?? [];

		console.log('→ Command:', commandName);
		console.log('→ Options:', JSON.stringify(options, null, 2));

		return {
			type: 4,
			data: {
				content: `✅ Command \`/${commandName}\` empfangen! (Dummy-Endpoint)`,
			},
		};
	}

	// Fallback
	console.log('→ Unknown interaction type:', body?.type);
	return { type: 1 };
});
