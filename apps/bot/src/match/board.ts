import type { MatchState } from '@onog/shared';
import {
	BUTTON_LABEL_MAX,
	ButtonStyle,
	ComponentType,
	type ActionRow,
	type Button,
	type MessageData,
} from '../discord';
import { buildCustomId, type MatchButtonAction } from './custom-id';

const COLORS = {
	veto: 0xed4245,
	pick: 0xfee75c,
	playing: 0x5865f2,
	finished: 0x57f287,
	aborted: 0x4f545c,
} satisfies Record<MatchState['phase'], number>;

const FORMAT_LABEL = { bo3: 'Bo3', bo5: 'Bo5', bo7: 'Bo7' } satisfies Record<MatchState['format'], string>;

/** Renders the match as the message the bot posts and updates on every click */
export function renderBoard(state: MatchState): MessageData {
	const [a, b] = state.players;
	return {
		embeds: [
			{
				title: `🎮 ${a.name} vs ${b.name} · ${FORMAT_LABEL[state.format]}`,
				description: [...describe(state), '', `Veranstalter: ${state.organizer.name}`].join('\n'),
				color: COLORS[state.phase],
			},
		],
		components: renderComponents(state),
	};
}

function nameOf(state: MatchState, discordId: string | null): string {
	return state.players.find((p) => p.discordId === discordId)?.name ?? '–';
}

function describe(state: MatchState): string[] {
	switch (state.phase) {
		case 'veto': {
			const total = state.mapPool.length - mapsToPlay(state);
			return [
				`🚫 **Veto-Phase:** <@${state.turnId}> ist am Zug (Veto ${state.vetoes.length + 1}/${total})`,
				...state.vetoes.map((v) => `~~${v.map}~~ (${nameOf(state, v.playerId)})`),
			];
		}
		case 'pick':
			return [
				`🗺️ **Map-Reihenfolge:** <@${state.turnId}> wählt Map ${state.order.length + 1}/${state.remainingMaps.length}`,
				...state.order.map((o, i) => `${i + 1}. ${o.map} (${nameOf(state, o.pickedById)})`),
			];
		case 'playing':
			return [`⚔️ ${score(state)} · First to ${state.winsNeeded}`, '', ...gameLines(state)];
		case 'finished':
			return [
				`🏆 **${nameOf(state, state.winnerId)} gewinnt!** ${score(state)}`,
				'',
				...gameLines(state),
			];
		case 'aborted':
			return ['✖ **Match abgebrochen**', ...(state.games.length > 0 ? ['', ...gameLines(state)] : [])];
	}
}

function mapsToPlay(state: MatchState): number {
	return state.winsNeeded * 2 - 1;
}

function score(state: MatchState): string {
	const [a, b] = state.players;
	return `**${a.name} ${state.wins[a.discordId]} : ${state.wins[b.discordId]} ${b.name}**`;
}

function gameLines(state: MatchState): string[] {
	const played = state.games.filter((g) => g.winnerId !== null).length;
	return state.games.map((game, i) => {
		if (game.winnerId) return `✅ ${i + 1}. ${game.map}: ${nameOf(state, game.winnerId)}`;
		if (state.phase === 'playing' && i === played) return `▶️ ${i + 1}. ${game.map}`;
		if (state.phase === 'finished') return `➖ ${i + 1}. ${game.map}: nicht gespielt`;
		return `▫️ ${i + 1}. ${game.map}`;
	});
}

function button(
	state: MatchState,
	action: MatchButtonAction,
	label: string,
	style: Button['style'],
	options: { arg?: string; disabled?: boolean } = {},
): Button {
	return {
		type: ComponentType.Button,
		style,
		label: label.length > BUTTON_LABEL_MAX ? `${label.slice(0, BUTTON_LABEL_MAX - 1)}…` : label,
		// Disabled buttons still need a unique custom_id within the message
		custom_id: buildCustomId(state, action, options.arg),
		...(options.disabled && { disabled: true }),
	};
}

/** Up to five buttons per row; a message holds at most five rows */
function rows(buttons: Button[]): ActionRow[] {
	const perRow = Math.min(5, Math.max(3, Math.ceil(buttons.length / 4)));
	const result: ActionRow[] = [];
	for (let i = 0; i < buttons.length; i += perRow) {
		result.push({ type: ComponentType.ActionRow, components: buttons.slice(i, i + perRow) });
	}
	return result;
}

function hasHistory(state: MatchState): boolean {
	return state.vetoes.length > 0 || state.order.some((o) => o.pickedById !== null);
}

function controlRow(state: MatchState): ActionRow {
	return {
		type: ComponentType.ActionRow,
		components: [
			button(state, 'undo', '↩ Rückgängig', ButtonStyle.Secondary, { disabled: !hasHistory(state) }),
			button(state, 'abort', '✖ Abbrechen', ButtonStyle.Danger),
		],
	};
}

function renderComponents(state: MatchState): ActionRow[] {
	switch (state.phase) {
		case 'veto': {
			const maps = state.mapPool.map((map) => {
				const veto = state.vetoes.find((v) => v.map === map);
				return veto
					? button(state, 'veto', `🚫 ${map}`, ButtonStyle.Secondary, { arg: map, disabled: true })
					: button(state, 'veto', map, ButtonStyle.Primary, { arg: map });
			});
			return [...rows(maps), controlRow(state)];
		}
		case 'pick': {
			const open = state.remainingMaps.filter((map) => !state.order.some((o) => o.map === map));
			const maps = open.map((map) => button(state, 'pick', map, ButtonStyle.Primary, { arg: map }));
			return [...rows(maps), controlRow(state)];
		}
		case 'playing':
			return [
				{
					type: ComponentType.ActionRow,
					components: state.players.map((p) =>
						button(state, 'win', `🏆 ${p.name}`, ButtonStyle.Success, { arg: p.discordId }),
					),
				},
				controlRow(state),
			];
		case 'finished':
			return [
				{
					type: ComponentType.ActionRow,
					components: [button(state, 'undo', '↩ Rückgängig (Veranstalter)', ButtonStyle.Secondary)],
				},
			];
		case 'aborted':
			return [];
	}
}
