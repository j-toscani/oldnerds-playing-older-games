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

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_APP_ID = process.env.DISCORD_APP_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_APP_ID) {
	console.error('❌ DISCORD_BOT_TOKEN und DISCORD_APP_ID müssen gesetzt sein.');
	console.error('   Setze die Werte in .env oder als Umgebungsvariablen.');
	process.exit(1);
}

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
const url = DISCORD_GUILD_ID
	? `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`
	: `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`;

const scope = DISCORD_GUILD_ID ? `Guild ${DISCORD_GUILD_ID}` : 'Global';

console.log(`📡 Registriere ${commands.length} Command(s) als ${scope}...`);
console.log(`   URL: ${url}`);

const response = await fetch(url, {
	method: 'PUT',
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
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
