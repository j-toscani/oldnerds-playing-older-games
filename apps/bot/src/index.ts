import { Hono } from 'hono';
import nacl from 'tweetnacl';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_APP_KEY ?? '';
const APP_URL = process.env.APP_URL ?? 'https://onog.j-toscani.com';

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

function handleGameday(options: Array<{ name: string; value: string }>) {
	const playersValue = options.find((o) => o.name === 'with')?.value ?? '';
	const players = playersValue
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean);

	if (players.length < 2) {
		return {
			type: 4,
			data: {
				content:
					'❌ Mindestens 2 Spieler werden benötigt.\nBeispiel: `/gameday with:Tick, Trick, Gustav`',
			},
		};
	}

	const playersParam = encodeURIComponent(JSON.stringify(players));
	const url = `${APP_URL}/?players=${playersParam}`;

	return {
		type: 4,
		data: {
			embeds: [
				{
					title: '🎮 Zockung kann los gehen!',
					description: `👥 **Spieler:** ${players.join(', ')}\n\n🔗 [Hier starten!](${url})`,
					color: 0x5865f2,
				},
			],
		},
	};
}

const app = new Hono();

app.post('/api/discord/interactions', async (c) => {
	const rawBody = await c.req.text();
	const signature = c.req.header('x-signature-ed25519') ?? '';
	const timestamp = c.req.header('x-signature-timestamp') ?? '';

	// Verify signature
	if (!verifySignature(signature, timestamp, rawBody)) {
		return c.text('Invalid request signature', 401);
	}

	const body = JSON.parse(rawBody);

	if (body?.type === 1) {
		return c.json({ type: 1 });
	}

	if (body?.type === 2) {
		const commandName = body?.data?.name ?? 'unknown';
		const options = body?.data?.options ?? [];

		if (commandName === 'gameday') {
			return c.json(handleGameday(options));
		}

		return c.json({
			type: 4,
			data: {
				content: `❓ Unbekannter Command: \`/${commandName}\``,
			},
		});
	}

	// Fallback
	console.log('→ Unknown interaction type:', body?.type);
	return c.json({ type: 1 });
});

// Health-Endpoint
app.get('/health', (c) => {
	return c.json({
		status: 'ok',
		service: 'bot',
		timestamp: new Date().toISOString(),
	});
});

// Server starten
const PORT = parseInt(process.env.PORT ?? '4000', 10);

console.log(`🤖 Bot Service läuft auf Port ${PORT}`);

export default {
	port: PORT,
	fetch: app.fetch,
};
