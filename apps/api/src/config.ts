import { z } from 'zod';

const envSchema = z.object({
	PORT: z.coerce.number().default(5000),
	SURREAL_URL: z.string().default('ws://localhost:8000'),
	SURREAL_NAMESPACE: z.string().default('onog'),
	SURREAL_DATABASE: z.string().default('onog'),
	SURREAL_USER: z.string().default('root'),
	SURREAL_PASS: z.string().default('root'),
});

export const config = envSchema.parse(process.env);
