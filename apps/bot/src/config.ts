import { z } from 'zod';

const envSchema = z.object({
	PORT: z.coerce.number().default(4000),
	DISCORD_APP_KEY: z.string().min(1, 'DISCORD_APP_KEY muss gesetzt sein'),
	APP_URL: z.string().url().default('https://onog.j-toscani.com'),
});

export const config = envSchema.parse(process.env);
