import { logger } from '@onog/shared';
import { api } from '../api';
import {
	displayName,
	ephemeral,
	ResponseType,
	type DiscordUser,
	type Interaction,
} from '../discord';
import { renderBoard } from './board';
import { parseCustomId } from './custom-id';

const ERROR_MESSAGES: Record<string, string> = {
	forbidden: '⛔ Das darfst du in diesem Match nicht.',
	not_your_turn: '⏳ Du bist gerade nicht am Zug.',
	invalid: '⚠️ Diese Aktion passt nicht zum aktuellen Stand.',
	closed: '🔒 Dieses Match ist bereits abgeschlossen.',
	expired: '⌛ Match abgelaufen: 24 Stunden ohne Aktivität.',
	stale: '🔄 Das Match hat sich gerade geändert. Bitte nochmal klicken.',
	not_found: '❓ Dieses Match gibt es nicht mehr.',
};

const UNEXPECTED_ERROR = '💥 Da ist etwas schiefgelaufen. Bitte versuch es gleich nochmal.';

const FORMATS = ['bo3', 'bo5', 'bo7'] as const;

/** `/match player1:@User player2:@User format:Bo3|Bo5|Bo7` */
export async function handleMatchCommand(interaction: Interaction) {
	const organizerUser = interaction.member?.user;
	if (!interaction.guild_id || !interaction.channel_id || !organizerUser) {
		return ephemeral('❌ `/match` funktioniert nur auf einem Server.');
	}

	const option = (name: string) => interaction.data?.options?.find((o) => o.name === name)?.value;
	const playerIds = [option('player1'), option('player2')];
	const format = FORMATS.find((f) => f === option('format'));
	const resolved = interaction.data?.resolved;
	const users = playerIds.map((id) => (id ? resolved?.users?.[id] : undefined));

	if (!format || !users[0] || !users[1]) {
		return ephemeral('❌ Bitte zwei Spieler und ein Format angeben.');
	}
	if (users[0].id === users[1].id) {
		return ephemeral('❌ Ein Match braucht zwei verschiedene Spieler.');
	}
	if (users.some((user) => user!.bot)) {
		return ephemeral('❌ Bots können nicht mitspielen.');
	}

	const person = (user: DiscordUser) => ({
		discordId: user.id,
		name: displayName(user, resolved?.members?.[user.id]),
	});

	try {
		const response = await api.api.bot.matches.$post({
			json: {
				players: [person(users[0]), person(users[1])],
				organizer: {
					discordId: organizerUser.id,
					name: displayName(organizerUser, interaction.member),
				},
				format,
				guildId: interaction.guild_id,
				channelId: interaction.channel_id,
			},
		});

		if (response.status !== 201) {
			logger.error('[match] Creating a match failed with status', response.status, await response.text());
			return ephemeral(UNEXPECTED_ERROR);
		}

		const { state } = await response.json();
		return { type: ResponseType.ChannelMessage, data: renderBoard(state) };
	} catch (error) {
		logger.error('[match] Creating a match failed:', error);
		return ephemeral(UNEXPECTED_ERROR);
	}
}

/** A click on one of the board's buttons */
export async function handleMatchButton(interaction: Interaction) {
	const button = parseCustomId(interaction.data?.custom_id ?? '');
	const actorId = interaction.member?.user?.id ?? interaction.user?.id;
	if (!button || !actorId) return ephemeral(UNEXPECTED_ERROR);

	const action = (() => {
		switch (button.action) {
			case 'veto':
			case 'pick':
				return { type: button.action, map: button.arg };
			case 'win':
				return { type: 'result' as const, winnerId: button.arg };
			case 'undo':
			case 'abort':
				return { type: button.action };
		}
	})();

	try {
		const response = await api.api.bot.matches[':id'].actions.$post({
			param: { id: button.matchId },
			json: { actorId, expectedVersion: button.version, action },
		});

		if (response.status === 200) {
			const { state } = await response.json();
			return { type: ResponseType.UpdateMessage, data: renderBoard(state) };
		}

		const body = await response.json();
		const message = 'error' in body ? ERROR_MESSAGES[body.error] : undefined;
		if (!message) logger.error('[match] Unexpected action response', response.status, body);
		return ephemeral(message ?? UNEXPECTED_ERROR);
	} catch (error) {
		logger.error('[match] Action failed:', error);
		return ephemeral(UNEXPECTED_ERROR);
	}
}
