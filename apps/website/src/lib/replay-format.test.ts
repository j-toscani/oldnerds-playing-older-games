/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import type { ReplayPlayer } from '@onog/shared';
import { formatDuration, formatTeams } from './replay-format';

function player(name: string, team: number): ReplayPlayer {
	return { name, toonHandle: '1-S2-1-1', race: 'Zerg', team, control: 'human' };
}

describe('formatDuration', () => {
	test('shows minutes and seconds', () => {
		expect(formatDuration(520)).toBe('8:40');
		expect(formatDuration(5)).toBe('0:05');
	});

	test('adds hours for long games', () => {
		expect(formatDuration(3725)).toBe('1:02:05');
	});
});

describe('formatTeams', () => {
	test('puts the teams against each other', () => {
		expect(formatTeams([player('A', 0), player('B', 1)])).toBe('A vs B');
	});

	test('groups team mates, whatever order the replay lists them in', () => {
		expect(formatTeams([player('C', 1), player('A', 0), player('D', 1), player('B', 0)])).toBe('A, B vs C, D');
	});
});
