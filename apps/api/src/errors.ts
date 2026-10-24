import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ApiErrorCode, logger, type ApiErrorBody } from '@onog/shared';

const STATUS_BY_CODE = {
	bad_request: 400,
	unauthorized: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	upstream_failed: 502,
	internal: 500,
} as const satisfies Record<ApiErrorCode, ContentfulStatusCode>;

export type ApiErrorOptions = ErrorOptions & {
	/** Sent to the client next to code and message, e.g. the current state on a conflict */
	details?: unknown;
};

/**
 * An error the global handler turns into a JSON response. Throw it through the
 * factories, e.g. `throw ApiError.notFound('Match m1 not found')`.
 */
export class ApiError extends Error {
	readonly code: ApiErrorCode;
	readonly status: ContentfulStatusCode;
	readonly details: unknown;

	constructor(code: ApiErrorCode, message: string, options?: ApiErrorOptions) {
		super(message, options);
		this.name = 'ApiError';
		this.code = code;
		this.status = STATUS_BY_CODE[code];
		this.details = options?.details;
	}

	static badRequest(message: string, options?: ApiErrorOptions) {
		return ApiError.create(ApiErrorCode.BadRequest, message, options, ApiError.badRequest);
	}

	static unauthorized(message: string, options?: ApiErrorOptions) {
		return ApiError.create(ApiErrorCode.Unauthorized, message, options, ApiError.unauthorized);
	}

	static forbidden(message: string, options?: ApiErrorOptions) {
		return ApiError.create(ApiErrorCode.Forbidden, message, options, ApiError.forbidden);
	}

	static notFound(message: string, options?: ApiErrorOptions) {
		return ApiError.create(ApiErrorCode.NotFound, message, options, ApiError.notFound);
	}

	static conflict(message: string, options?: ApiErrorOptions) {
		return ApiError.create(ApiErrorCode.Conflict, message, options, ApiError.conflict);
	}

	static upstream(message: string, options?: ApiErrorOptions) {
		return ApiError.create(ApiErrorCode.Upstream, message, options, ApiError.upstream);
	}

	static internal(message: string, options?: ApiErrorOptions) {
		return ApiError.create(ApiErrorCode.Internal, message, options, ApiError.internal);
	}

	/** Builds the error and drops the factory's own frame, so the stack starts at the `throw` */
	private static create(
		code: ApiErrorCode,
		message: string,
		options: ApiErrorOptions | undefined,
		factory: Function,
	) {
		const error = new ApiError(code, message, options);
		Error.captureStackTrace(error, factory);
		return error;
	}

	toBody(): ApiErrorBody {
		const { code, message, details } = this;
		return { error: details === undefined ? { code, message } : { code, message, details } };
	}

	/** For structured logs; includes the stack, so never send it to a client */
	toJSON() {
		return {
			name: this.name,
			code: this.code,
			status: this.status,
			message: this.message,
			details: this.details,
			stack: this.stack,
			cause: this.cause,
		};
	}

	/** How `console.log` and the shared logger print the error */
	[Bun.inspect.custom]() {
		const frames = (this.stack ?? '')
			.split('\n')
			.filter((line) => line.trimStart().startsWith('at '));
		const lines = [`ApiError [${this.code} ${this.status}]: ${this.message}`, ...frames];
		if (this.details !== undefined) lines.push(`Details: ${Bun.inspect(this.details)}`);
		if (this.cause !== undefined) lines.push(`Caused by: ${Bun.inspect(this.cause)}`);
		return lines.join('\n');
	}
}

/** Turns everything thrown in handlers and middleware into a response */
export const errorHandler: ErrorHandler = (err, c) => {
	if (err instanceof ApiError) {
		// 4xx are expected outcomes; only server-side failures are worth a log line
		if (err.status >= 500) logger.error(err);
		return c.json(err.toBody(), err.status);
	}
	// Thrown by Hono's own helpers and middleware
	if (err instanceof HTTPException) {
		return err.getResponse();
	}

	logger.error('Unhandled error:', err);
	const body: ApiErrorBody = {
		error: { code: ApiErrorCode.Internal, message: 'Internal Server Error' },
	};
	return c.json(body, 500);
};
