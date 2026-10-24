import { expect, test } from 'bun:test';
import { buildCustomId, parseCustomId } from './custom-id';

test('round-trips a button through its custom_id', () => {
	const customId = buildCustomId({ matchId: 'k3j9x', version: 7 }, 'veto', "At Eternity's Edge LE (2)");

	expect(parseCustomId(customId)).toEqual({
		matchId: 'k3j9x',
		version: 7,
		action: 'veto',
		arg: "At Eternity's Edge LE (2)",
	});
});

test('keeps colons in the argument', () => {
	const customId = buildCustomId({ matchId: 'm1', version: 0 }, 'pick', 'Map: Reloaded');
	expect(parseCustomId(customId)?.arg).toBe('Map: Reloaded');
});

test('stays within the 100 character limit for long map names and Discord IDs', () => {
	const longestId = buildCustomId({ matchId: 'a'.repeat(20), version: 999 }, 'pick', 'x'.repeat(40));
	expect(longestId.length).toBeLessThanOrEqual(100);
});

test.each(['gameday:1', 'm:k3j9x:x:veto:A', 'm:k3j9x:1:dance:A', 'm::1:veto:A'])(
	'rejects %s',
	(customId) => {
		expect(parseCustomId(customId)).toBeNull();
	},
);
