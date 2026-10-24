/** The parts of the Discord interactions API the bot uses */

export const InteractionType = {
	Ping: 1,
	ApplicationCommand: 2,
	MessageComponent: 3,
} as const;

export const ResponseType = {
	Pong: 1,
	ChannelMessage: 4,
	UpdateMessage: 7,
} as const;

export const ComponentType = {
	ActionRow: 1,
	Button: 2,
} as const;

export const ButtonStyle = {
	Primary: 1,
	Secondary: 2,
	Success: 3,
	Danger: 4,
} as const;

export const MessageFlags = {
	Ephemeral: 64,
} as const;

/** Discord rejects button labels longer than this */
export const BUTTON_LABEL_MAX = 80;

export type DiscordUser = {
	id: string;
	username: string;
	global_name?: string | null;
	bot?: boolean;
};

export type DiscordMember = {
	user?: DiscordUser;
	nick?: string | null;
};

export type CommandOption = { name: string; type: number; value: string };

export type Interaction = {
	type: number;
	guild_id?: string;
	channel_id?: string;
	member?: DiscordMember;
	user?: DiscordUser;
	data?: {
		name?: string;
		options?: CommandOption[];
		custom_id?: string;
		resolved?: {
			users?: Record<string, DiscordUser>;
			members?: Record<string, Omit<DiscordMember, 'user'>>;
		};
	};
};

export type Button = {
	type: typeof ComponentType.Button;
	style: (typeof ButtonStyle)[keyof typeof ButtonStyle];
	label: string;
	custom_id: string;
	disabled?: boolean;
};

export type ActionRow = { type: typeof ComponentType.ActionRow; components: Button[] };

export type MessageData = {
	content?: string;
	embeds?: { title?: string; description?: string; color?: number }[];
	components?: ActionRow[];
	flags?: number;
};

export function ephemeral(content: string) {
	return {
		type: ResponseType.ChannelMessage,
		data: { content, flags: MessageFlags.Ephemeral } satisfies MessageData,
	};
}

/** The name a user shows in a server: nickname, then display name, then username */
export function displayName(user: DiscordUser, member?: Omit<DiscordMember, 'user'>): string {
	return member?.nick || user.global_name || user.username;
}
