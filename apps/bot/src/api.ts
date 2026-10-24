import type { AppType } from '@onog/api';
import { hc } from 'hono/client';
import { config } from './config';

// Annotated so the declaration build can name the type through `AppType`
type ApiClient = ReturnType<typeof hc<AppType>>;

/** Typed client for the API; the shared secret marks requests as coming from the bot */
export const api: ApiClient = hc<AppType>(config.API_URL, {
	headers: { 'X-Bot-Secret': config.BOT_API_SECRET },
});
