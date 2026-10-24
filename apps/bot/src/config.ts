import { z } from 'zod';

const envSchema = z.object({
	PORT: z.coerce.number().default(4000),
	DISCORD_APP_KEY: z.string().min(1, 'DISCORD_APP_KEY muss gesetzt sein'),
	APP_URL: z.string().url().default('https://onog.j-toscani.com'),
	API_URL: z.string().url().default('http://localhost:4001'),
	BOT_API_SECRET: z.string().min(32, 'BOT_API_SECRET muss mindestens 32 Zeichen haben'),
});

export const config = envSchema.parse(process.env);
