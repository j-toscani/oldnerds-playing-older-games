import { Hono } from 'hono';
import nacl from 'tweetnacl';
import { config } from './config';

function verifySignature(signature: string, timestamp: string, rawBody: string): boolean {
	try {
		const sigBuffer = Buffer.from(signature, 'hex');
		const pubKeyBuffer = Buffer.from(config.DISCORD_APP_KEY, 'hex');
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
	const url = `${config.APP_URL}/?players=${playersParam}`;

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

	return c.json({ type: 1 });
});

app.get('/health', (c) => {
	return c.json({
		status: 'ok',
		service: 'bot',
		timestamp: new Date().toISOString(),
	});
});

export default {
	port: config.PORT,
	fetch: app.fetch,
};
