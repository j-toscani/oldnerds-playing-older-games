const LOG_LEVELS = {
	debug: 0,
	info: 1,
	log: 2,
	error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

function getLogLevel(): LogLevel {
	let level: string | null | undefined;

	if (typeof window === 'undefined') {
		level = process.env.LOG_LEVEL;
	} else {
		try {
			level = localStorage.getItem('LOG_LEVEL');
		} catch {
			// localStorage might be unavailable
		}
	}

	return isLogLevel(level) ? level : 'info';
}

function isLogLevel(value: unknown): value is LogLevel {
	return typeof value === 'string' && value in LOG_LEVELS;
}

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()];
}

function formatPrefix(level: LogLevel): string {
	const timestamp = new Date().toISOString();
	return `[${timestamp}] [${level.toUpperCase()}]`;
}

export const logger = {
	debug(...args: unknown[]) {
		if (shouldLog('debug')) console.debug(formatPrefix('debug'), ...args);
	},

	info(...args: unknown[]) {
		if (shouldLog('info')) console.info(formatPrefix('info'), ...args);
	},

	log(...args: unknown[]) {
		if (shouldLog('log')) console.log(formatPrefix('log'), ...args);
	},

	error(...args: unknown[]) {
		if (shouldLog('error')) console.error(formatPrefix('error'), ...args);
	},
};
