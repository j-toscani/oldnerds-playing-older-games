import { describe, expect, test } from 'bun:test';
import type { MatchData, MatchEvent, MatchParticipant } from '@onog/shared';
import { deriveMatchState, MATCH_TIMEOUT_MS, planAction, type MatchAction } from './rules';

const TICK = '1';
const TRICK = '2';
const GUSTAV = '3';
const STRANGER = '9';

const POOL = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const NOW = new Date('2026-10-25T12:00:00Z');

function participant(discordId: string, role: MatchParticipant['role']): MatchParticipant {
	return { discordId, name: `user-${discordId}`, role };
}

/** Tick starts the veto; Gustav organizes without playing unless `organizer` says otherwise */
function makeMatch(overrides: Partial<MatchData> & { organizer?: string } = {}): MatchData {
	const { organizer = GUSTAV, ...rest } = overrides;
	return {
		id: 'm1',
		participants: [
			participant(TICK, 'player'),
			participant(TRICK, 'player'),
			participant(organizer, 'organizer'),
		],
		format: 'bo3',
		mapPool: POOL,
		vetoStarterId: TICK,
		status: 'veto',
		version: 0,
		winnerId: null,
		guildId: 'g',
		channelId: 'c',
		createdAt: NOW.toISOString(),
		updatedAt: NOW.toISOString(),
		finishedAt: null,
		...rest,
	};
}

/**
 * Plays the actions one after another, each by the actor whose turn it is
 * (or `actor` if given), and returns the match and events afterwards.
 */
function play(
	match: MatchData,
	steps: (MatchAction & { actor?: string })[],
): { match: MatchData; events: MatchEvent[] } {
	let events: MatchEvent[] = [];
	for (const { actor, ...action } of steps) {
		const state = deriveMatchState(match, events, NOW);
		const actorId = actor ?? state.turnId ?? TICK;
		const plan = planAction(match, events, actorId, action, NOW);
		if (!plan.ok) throw new Error(`${action.type} by ${actorId} failed: ${plan.error}`);

		const seq = match.version + 1;
		events =
			plan.write.kind === 'undo'
				? events.map((e) =>
						e.id === (plan.write as { eventId: string }).eventId
							? { ...e, undoneAt: NOW.toISOString(), undoneBy: actorId }
							: e,
					)
				: [
						...events,
						{
							...plan.write.event,
							id: `e${seq}`,
							matchId: match.id,
							seq,
							undoneAt: null,
							undoneBy: null,
							createdAt: NOW.toISOString(),
						},
					];
		match = { ...match, version: seq };
	}
	return { match, events };
}

const veto = (map: string, actor?: string): MatchAction & { actor?: string } => ({
	type: 'veto',
	map,
	actor,
});
const pick = (map: string, actor?: string): MatchAction & { actor?: string } => ({
	type: 'pick',
	map,
	actor,
});
const win = (winnerId: string, actor = winnerId): MatchAction & { actor?: string } => ({
	type: 'result',
	winnerId,
	actor,
});

/** Bo3 with all six vetoes done: G, H, I remain */
const BO3_VETOES = ['A', 'B', 'C', 'D', 'E', 'F'].map((map) => veto(map));
/** Bo3 with vetoes and picks done: order G, H, I */
const BO3_READY = [...BO3_VETOES, pick('G'), pick('H')];

describe('deriveMatchState', () => {
	test('alternates the veto turn, starting with the veto starter', () => {
		const match = makeMatch();
		expect(deriveMatchState(match, [], NOW).turnId).toBe(TICK);

		const afterOne = play(match, [veto('A')]);
		expect(deriveMatchState(afterOne.match, afterOne.events, NOW).turnId).toBe(TRICK);
	});

	test.each([
		['bo3', 6],
		['bo5', 4],
		['bo7', 2],
	] as const)('%s needs %i vetoes before the pick phase', (format, vetoes) => {
		const match = makeMatch({ format });
		const steps = POOL.slice(0, vetoes).map((map) => veto(map));

		const almost = play(match, steps.slice(0, -1));
		expect(deriveMatchState(almost.match, almost.events, NOW).phase).toBe('veto');

		const done = play(match, steps);
		expect(deriveMatchState(done.match, done.events, NOW).phase).toBe('pick');
	});

	test('the player who started the veto also picks the first map', () => {
		const { match, events } = play(makeMatch(), BO3_VETOES);
		expect(deriveMatchState(match, events, NOW).turnId).toBe(TICK);
	});

	test('sets the last map automatically and starts playing', () => {
		const { match, events } = play(makeMatch(), BO3_READY);
		const state = deriveMatchState(match, events, NOW);

		expect(state.phase).toBe('playing');
		expect(state.order).toEqual([
			{ map: 'G', pickedById: TICK },
			{ map: 'H', pickedById: TRICK },
			{ map: 'I', pickedById: null },
		]);
		expect(state.currentMap).toBe('G');
	});

	test.each([
		['bo3', 2],
		['bo5', 3],
		['bo7', 4],
	] as const)('%s ends once a player has %i wins', (format, winsNeeded) => {
		const base = makeMatch({ format });
		const vetoes = POOL.slice(0, POOL.length - winsNeeded * 2 + 1).map((map) => veto(map));
		const remaining = POOL.slice(vetoes.length);
		const picks = remaining.slice(0, -1).map((map) => pick(map));
		const wins = Array.from({ length: winsNeeded }, () => win(TRICK));

		const almost = play(base, [...vetoes, ...picks, ...wins.slice(0, -1)]);
		expect(deriveMatchState(almost.match, almost.events, NOW).phase).toBe('playing');

		const done = play(base, [...vetoes, ...picks, ...wins]);
		const state = deriveMatchState(done.match, done.events, NOW);
		expect(state.phase).toBe('finished');
		expect(state.winnerId).toBe(TRICK);
		expect(state.wins).toEqual({ [TICK]: 0, [TRICK]: winsNeeded });
	});

	test('undo crosses phase boundaries', () => {
		const { match, events } = play(makeMatch(), [...BO3_VETOES, { type: 'undo', actor: TRICK }]);
		const state = deriveMatchState(match, events, NOW);

		expect(state.phase).toBe('veto');
		expect(state.turnId).toBe(TRICK);
		expect(state.remainingMaps).toContain('F');
	});

	test('an open match without activity for 24 hours counts as aborted', () => {
		const later = new Date(NOW.getTime() + MATCH_TIMEOUT_MS + 1);
		expect(deriveMatchState(makeMatch(), [], later).phase).toBe('aborted');
	});
});

describe('planAction permissions', () => {
	const tryAction = (
		setup: { match: MatchData; events: MatchEvent[] },
		actorId: string,
		action: MatchAction,
		now = NOW,
	) => {
		const plan = planAction(setup.match, setup.events, actorId, action, now);
		return plan.ok ? 'ok' : plan.error;
	};

	const start = () => play(makeMatch(), []);
	const startPlayingOrganizer = () => play(makeMatch({ organizer: TICK }), []);

	describe('veto / pick', () => {
		test('the player whose turn it is may veto', () => {
			expect(tryAction(start(), TICK, { type: 'veto', map: 'A' })).toBe('ok');
		});

		test('the other player has to wait', () => {
			expect(tryAction(start(), TRICK, { type: 'veto', map: 'A' })).toBe('not_your_turn');
		});

		test('an organizer who does not play vetoes for the player whose turn it is', () => {
			const plan = planAction(start().match, [], GUSTAV, { type: 'veto', map: 'A' }, NOW);
			expect(plan.ok && plan.write.kind === 'create' && plan.write.event).toMatchObject({
				playerId: TICK,
				actorId: GUSTAV,
			});
		});

		test('a playing organizer may only veto on their own turn', () => {
			const setup = startPlayingOrganizer();
			expect(tryAction(setup, TICK, { type: 'veto', map: 'A' })).toBe('ok');

			const afterOne = play(setup.match, [veto('A')]);
			expect(tryAction(afterOne, TICK, { type: 'veto', map: 'B' })).toBe('not_your_turn');
		});

		test('strangers may not veto', () => {
			expect(tryAction(start(), STRANGER, { type: 'veto', map: 'A' })).toBe('forbidden');
		});

		test('a vetoed map cannot be vetoed again', () => {
			const setup = play(makeMatch(), [veto('A')]);
			expect(tryAction(setup, TRICK, { type: 'veto', map: 'A' })).toBe('invalid');
		});

		test('picking during the veto phase is invalid', () => {
			expect(tryAction(start(), TICK, { type: 'pick', map: 'A' })).toBe('invalid');
		});

		test('the pick phase follows the same turn rules', () => {
			const setup = play(makeMatch(), BO3_VETOES);
			expect(tryAction(setup, TICK, { type: 'pick', map: 'G' })).toBe('ok');
			expect(tryAction(setup, TRICK, { type: 'pick', map: 'G' })).toBe('not_your_turn');
			expect(tryAction(setup, GUSTAV, { type: 'pick', map: 'G' })).toBe('ok');
		});
	});

	describe('result', () => {
		const ready = () => play(makeMatch(), BO3_READY);

		test.each([
			['both players', TICK],
			['both players', TRICK],
			['the organizer', GUSTAV],
		])('%s may set the winner (%s)', (_, actor) => {
			expect(tryAction(ready(), actor, { type: 'result', winnerId: TICK })).toBe('ok');
		});

		test('strangers may not set the winner', () => {
			expect(tryAction(ready(), STRANGER, { type: 'result', winnerId: TICK })).toBe('forbidden');
		});

		test('the winner must be one of the players', () => {
			expect(tryAction(ready(), TICK, { type: 'result', winnerId: GUSTAV })).toBe('invalid');
		});
	});

	describe('undo while running', () => {
		const afterTickVeto = () => play(makeMatch(), [veto('A')]);

		test('a player may undo their own last step', () => {
			expect(tryAction(afterTickVeto(), TICK, { type: 'undo' })).toBe('ok');
		});

		test("a player may not undo the other player's step", () => {
			expect(tryAction(afterTickVeto(), TRICK, { type: 'undo' })).toBe('forbidden');
		});

		test('an organizer who does not play may undo any last step', () => {
			expect(tryAction(afterTickVeto(), GUSTAV, { type: 'undo' })).toBe('ok');
		});

		test("a playing organizer may not undo the opponent's step", () => {
			const setup = play(makeMatch({ organizer: TICK }), [veto('A'), veto('B')]);
			expect(tryAction(setup, TICK, { type: 'undo' })).toBe('forbidden');
		});
	});

	describe('after the match is finished', () => {
		const finished = (organizer = GUSTAV) =>
			play(makeMatch({ organizer }), [...BO3_READY, win(TRICK), win(TRICK)]);

		test('players may not undo', () => {
			expect(tryAction(finished(), TRICK, { type: 'undo' })).toBe('forbidden');
		});

		test.each([
			['who does not play', GUSTAV],
			['who plays', TICK],
		])('the organizer %s may undo within 24 hours', (_, organizer) => {
			const setup = finished(organizer);
			expect(tryAction(setup, organizer, { type: 'undo' })).toBe('ok');

			const plan = planAction(setup.match, setup.events, organizer, { type: 'undo' }, NOW);
			expect(plan.ok && plan.next.phase).toBe('playing');
		});

		test('the result is frozen after 24 hours', () => {
			const later = new Date(NOW.getTime() + MATCH_TIMEOUT_MS + 1);
			expect(tryAction(finished(), GUSTAV, { type: 'undo' }, later)).toBe('expired');
		});

		test('other actions are closed', () => {
			expect(tryAction(finished(), GUSTAV, { type: 'abort' })).toBe('closed');
		});
	});

	describe('abort', () => {
		test('only the organizer may abort', () => {
			expect(tryAction(start(), GUSTAV, { type: 'abort' })).toBe('ok');
			expect(tryAction(start(), TICK, { type: 'abort' })).toBe('forbidden');
		});

		test('a playing organizer may abort too', () => {
			expect(tryAction(startPlayingOrganizer(), TICK, { type: 'abort' })).toBe('ok');
		});

		test('an abort is final', () => {
			const setup = play(makeMatch(), [{ type: 'abort', actor: GUSTAV }]);
			expect(tryAction(setup, GUSTAV, { type: 'undo' })).toBe('closed');
		});
	});

	test('a click on an open match after 24 hours reports it as expired', () => {
		const later = new Date(NOW.getTime() + MATCH_TIMEOUT_MS + 1);
		expect(tryAction(start(), TICK, { type: 'veto', map: 'A' }, later)).toBe('expired');
	});

	test('a match stored as aborted by the timeout stays expired', () => {
		const setup = play(makeMatch({ status: 'aborted' }), []);
		expect(tryAction(setup, TICK, { type: 'veto', map: 'A' })).toBe('expired');
	});
});
