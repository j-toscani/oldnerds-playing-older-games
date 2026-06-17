import { z } from 'zod';

const envSchema = z.object({
	PORT: z.coerce.number().default(5000),
	SURREAL_URL: z.string().default('ws://localhost:8000'),
	SURREAL_NAMESPACE: z.string().default('onog'),
	SURREAL_DATABASE: z.string().default('onog'),
	SURREAL_USER: z.string().default('root'),
	SURREAL_PASS: z.string().default('root'),
	DISCORD_CLIENT_ID: z.string().min(1),
	DISCORD_CLIENT_SECRET: z.string().min(1),
	DISCORD_REDIRECT_URI: z.string().url(),
	DISCORD_GUILD_ID: z.string().min(1),
	JWT_SECRET: z.string().min(32),
	ALLOWED_ORIGIN: z.string().url().default('https://onog.tosco.dev'),
});

export const config = envSchema.parse(process.env);
