import { defineHandler } from 'nitro';
import nacl from 'tweetnacl';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_APP_KEY ?? '';

function verifySignature(signature: string, timestamp: string, rawBody: string): boolean {
	if (!DISCORD_PUBLIC_KEY) {
		console.warn('DISCORD_APP_KEY not set — skipping verification');
		return false;
	}

	try {
		const sigBuffer = Buffer.from(signature, 'hex');
		const pubKeyBuffer = Buffer.from(DISCORD_PUBLIC_KEY, 'hex');
		const message = Buffer.from(timestamp + rawBody, 'utf-8');

		return nacl.sign.detached.verify(message, sigBuffer, pubKeyBuffer);
	} catch {
		return false;
	}
}

export default defineHandler(async (event) => {
	const rawBody = await event.req.text();
	const signature = event.req.headers.get('x-signature-ed25519') ?? '';
	const timestamp = event.req.headers.get('x-signature-timestamp') ?? '';

	console.log('=== Discord Interaction Received ===');
	console.log('Signature:', signature ? '✓ present' : '✗ missing');
	console.log('Timestamp:', timestamp || 'missing');

	// Verify signature
	if (!verifySignature(signature, timestamp, rawBody)) {
		console.log('→ Invalid signature, rejecting');
		return new Response('Invalid request signature', { status: 401 });
	}

	const body = JSON.parse(rawBody);
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
