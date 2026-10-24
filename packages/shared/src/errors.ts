/** Every error code the API answers with; clients branch on these, not on messages */
export const ApiErrorCode = {
	BadRequest: 'bad_request',
	Unauthorized: 'unauthorized',
	Forbidden: 'forbidden',
	NotFound: 'not_found',
	Conflict: 'conflict',
	Upstream: 'upstream_failed',
	Internal: 'internal',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/** The body of every API error response; `details` depends on the endpoint */
export type ApiErrorBody<TDetails = unknown> = {
	error: {
		code: ApiErrorCode;
		message: string;
		details?: TDetails;
	};
};
