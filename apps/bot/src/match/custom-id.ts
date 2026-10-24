import type { MatchState } from '@onog/shared';

export type MatchButtonAction = 'veto' | 'pick' | 'win' | 'undo' | 'abort';

export type MatchButton = {
	matchId: string;
	/** The match version the board showed when it was clicked */
	version: number;
	action: MatchButtonAction;
	/** Map name for veto/pick, Discord ID for win */
	arg: string;
};

const PREFIX = 'm';
const ACTIONS: MatchButtonAction[] = ['veto', 'pick', 'win', 'undo', 'abort'];

/**
 * `m:<matchId>:<version>:<action>:<arg>`. The argument comes last so it may
 * contain colons. Discord limits a custom_id to 100 characters.
 */
export function buildCustomId(
	state: Pick<MatchState, 'matchId' | 'version'>,
	action: MatchButtonAction,
	arg = '',
): string {
	return [PREFIX, state.matchId, state.version, action, arg].join(':');
}

export function isMatchCustomId(customId: string): boolean {
	return customId.startsWith(`${PREFIX}:`);
}

export function parseCustomId(customId: string): MatchButton | null {
	const [prefix, matchId, version, action, ...rest] = customId.split(':');
	if (prefix !== PREFIX || !matchId || !ACTIONS.includes(action as MatchButtonAction)) return null;

	const parsedVersion = Number(version);
	if (!Number.isInteger(parsedVersion) || parsedVersion < 0) return null;

	return {
		matchId,
		version: parsedVersion,
		action: action as MatchButtonAction,
		arg: rest.join(':'),
	};
}
