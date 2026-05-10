import type { ReactNode } from 'react';

type TurnIndicatorProps = {
	label: string;
	playerName: string;
	player: 'p1' | 'p2';
};

export function TurnIndicator({ label, playerName, player }: TurnIndicatorProps) {
	return (
		<div
			className={`mb-6 py-4 px-5 rounded-[10px] border-2 ${
				player === 'p1'
					? 'border-accent-blue/40 bg-accent-blue/10'
					: 'border-accent-gold/40 bg-accent-gold/10'
			}`}
		>
			<span className="text-text-muted text-base block mb-1">{label}</span>
			<span
				className={`font-bold text-2xl ${player === 'p1' ? 'text-accent-blue-lighter' : 'text-accent-gold-light'}`}
			>
				{playerName}
			</span>
		</div>
	);
}

export function SectionLabel({ children }: { children: ReactNode }) {
	return (
		<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
			{children}
		</h2>
	);
}

export function MapList({ children }: { children: ReactNode }) {
	return <ol className="list-none flex flex-col gap-2 mb-6">{children}</ol>;
}

type MapListItemProps = {
	children: ReactNode;
	className?: string;
};

export function MapListItem({ children, className = '' }: MapListItemProps) {
	return (
		<li
			className={`flex items-center gap-2 bg-bg-card border border-border-base rounded-[10px] transition-all duration-200 hover:border-border-hover ${className}`}
		>
			{children}
		</li>
	);
}

type PlayerBadgeProps = {
	player: 'p1' | 'p2';
	children: ReactNode;
};

export function PlayerBadge({ player, children }: PlayerBadgeProps) {
	return (
		<span
			className={`text-xs font-medium px-2 py-1 rounded-md ${
				player === 'p1'
					? 'bg-accent-blue/15 text-accent-blue-lighter'
					: 'bg-accent-gold/15 text-accent-gold-light'
			}`}
		>
			{children}
		</span>
	);
}
