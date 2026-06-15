/**
 * Script zum Registrieren des /gameday Slash-Commands bei Discord.
 *
 * Verwendung:
 *   bun run scripts/register-commands.ts
 *
 * Benötigte Env-Variablen (aus .env):
 *   DISCORD_BOT_TOKEN — Bot Token
 *   DISCORD_APP_ID   — Application ID
 *
 * Optional:
 *   DISCORD_GUILD_ID — Server-ID für Guild-Command (schneller zum Testen)
 *                      Ohne Guild-ID wird ein Global-Command registriert (bis zu 1h Delay)
 */

import { z } from 'zod';

const envSchema = z.object({
	DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN muss gesetzt sein'),
	DISCORD_APP_ID: z.string().min(1, 'DISCORD_APP_ID muss gesetzt sein'),
	DISCORD_GUILD_ID: z.string().optional(),
});

const config = envSchema.parse(process.env);

const commands = [
	{
		name: 'gameday',
		description: 'Startet einen Spieleabend. Spielernamen kommagetrennt angeben.',
		options: [
			{
				name: 'with',
				description: 'Spielernamen, kommagetrennt (z.B. "Tick, Trick, Gustav")',
				type: 3, // STRING
				required: true,
			},
		],
	},
];

// Guild-Command (sofort verfügbar) oder Global-Command (bis zu 1h Delay)
const url = config.DISCORD_GUILD_ID
	? `https://discord.com/api/v10/applications/${config.DISCORD_APP_ID}/guilds/${config.DISCORD_GUILD_ID}/commands`
	: `https://discord.com/api/v10/applications/${config.DISCORD_APP_ID}/commands`;

const scope = config.DISCORD_GUILD_ID ? `Guild ${config.DISCORD_GUILD_ID}` : 'Global';

console.log(`📡 Registriere ${commands.length} Command(s) als ${scope}...`);
console.log(`   URL: ${url}`);

const response = await fetch(url, {
	method: 'PUT',
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bot ${config.DISCORD_BOT_TOKEN}`,
	},
	body: JSON.stringify(commands),
});

if (!response.ok) {
	const error = await response.text();
	console.error(`❌ Fehler ${response.status}: ${error}`);
	process.exit(1);
}

const result = await response.json();
console.log(`✅ ${(result as unknown[]).length} Command(s) erfolgreich registriert:`);
for (const cmd of result as Array<{ name: string; id: string }>) {
	console.log(`   /${cmd.name} (ID: ${cmd.id})`);
}
