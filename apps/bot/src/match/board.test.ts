import { expect, test } from 'bun:test';
import type { MatchState } from '@onog/shared';
import { renderBoard } from './board';
import { parseCustomId } from './custom-id';

const POOL = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

function makeState(overrides: Partial<MatchState> = {}): MatchState {
	return {
		matchId: 'm1',
		version: 0,
		format: 'bo3',
		phase: 'veto',
		players: [
			{ discordId: '1', name: 'Tick', role: 'player' },
			{ discordId: '2', name: 'Trick', role: 'player' },
		],
		organizer: { discordId: '3', name: 'Gustav', role: 'organizer' },
		mapPool: POOL,
		vetoes: [],
		remainingMaps: POOL,
		order: [],
		turnId: '1',
		games: [],
		currentMap: null,
		wins: { '1': 0, '2': 0 },
		winsNeeded: 2,
		winnerId: null,
		...overrides,
	};
}

function buttons(state: MatchState) {
	return (renderBoard(state).components ?? []).flatMap((row) => row.components);
}

test('the veto board has a button per map, disables vetoed maps and stays within Discord limits', () => {
	const state = makeState({
		version: 1,
		vetoes: [{ map: 'A', playerId: '1' }],
		remainingMaps: POOL.slice(1),
		turnId: '2',
	});
	const board = renderBoard(state);

	expect(board.components!.length).toBeLessThanOrEqual(5);
	for (const row of board.components!) expect(row.components.length).toBeLessThanOrEqual(5);

	const vetoButtons = buttons(state).filter((b) => parseCustomId(b.custom_id)?.action === 'veto');
	expect(vetoButtons).toHaveLength(9);
	expect(vetoButtons.filter((b) => b.disabled).map((b) => parseCustomId(b.custom_id)?.arg)).toEqual(['A']);
	expect(board.embeds![0].description).toContain('<@2> ist am Zug (Veto 2/6)');
});

test('buttons carry the version the board shows', () => {
	const versions = buttons(makeState({ version: 4 })).map((b) => parseCustomId(b.custom_id)?.version);
	expect(new Set(versions)).toEqual(new Set([4]));
});

test('undo is disabled until something happened', () => {
	const undo = buttons(makeState()).find((b) => parseCustomId(b.custom_id)?.action === 'undo');
	expect(undo?.disabled).toBe(true);
});

test('the pick board offers only maps that are not ordered yet', () => {
	const state = makeState({
		phase: 'pick',
		vetoes: POOL.slice(0, 6).map((map) => ({ map, playerId: '1' })),
		remainingMaps: ['G', 'H', 'I'],
		order: [{ map: 'G', pickedById: '2' }],
		turnId: '1',
	});
	const pickArgs = buttons(state)
		.map((b) => parseCustomId(b.custom_id))
		.filter((b) => b?.action === 'pick')
		.map((b) => b?.arg);

	expect(pickArgs).toEqual(['H', 'I']);
});

test('the playing board shows the score and a winner button per player', () => {
	const state = makeState({
		phase: 'playing',
		remainingMaps: ['G', 'H', 'I'],
		order: [
			{ map: 'G', pickedById: '2' },
			{ map: 'H', pickedById: '1' },
			{ map: 'I', pickedById: null },
		],
		games: [
			{ map: 'G', winnerId: '1' },
			{ map: 'H', winnerId: null },
			{ map: 'I', winnerId: null },
		],
		currentMap: 'H',
		turnId: null,
		wins: { '1': 1, '2': 0 },
	});
	const board = renderBoard(state);

	expect(board.embeds![0].description).toContain('**Tick 1 : 0 Trick**');
	expect(board.embeds![0].description).toContain('▶️ 2. H');
	expect(
		buttons(state)
			.map((b) => parseCustomId(b.custom_id))
			.filter((b) => b?.action === 'win')
			.map((b) => b?.arg),
	).toEqual(['1', '2']);
});

test('a finished board only offers the organizer undo', () => {
	const state = makeState({ phase: 'finished', winnerId: '2', wins: { '1': 0, '2': 2 }, turnId: null });
	expect(buttons(state).map((b) => parseCustomId(b.custom_id)?.action)).toEqual(['undo']);
	expect(renderBoard(state).embeds![0].description).toContain('Trick gewinnt!');
});

test('an aborted board has no buttons', () => {
	expect(renderBoard(makeState({ phase: 'aborted', turnId: null })).components).toEqual([]);
});
