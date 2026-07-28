import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import type { GamedayData, MatchupWithState } from '@onog/shared';
import { PageContainer, PageTitle, PageSubtitle } from '../components/layout';
import { SectionLabel, PlayerBadge } from '../components/game-ui';
import { ButtonLink, ActionBar } from '../components/buttons';
import { useGamedayEvents, type ConnectionStatus } from '../lib/useGamedayEvents';
import { api } from '../lib/api';

export const Route = createFileRoute('/gameday/$id')({
	component: GamedayLive,
});

const STATUS_LABEL: Record<ConnectionStatus, string> = {
	connecting: 'Verbinde …',
	open: 'Live',
	closed: 'Getrennt',
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
	connecting: 'bg-accent-gold-light animate-pulse',
	open: 'bg-green-400',
	closed: 'bg-accent-red',
};

function GamedayLive() {
	const { id } = Route.useParams();
	const [gameday, setGameday] = useState<GamedayData | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Initial load via the typed RPC client. All subsequent updates arrive via
	// SSE — no polling.
	useEffect(() => {
		const controller = new AbortController();
		api.api.gamedays[':id']
			.$get({ param: { id } }, { init: { signal: controller.signal } })
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				setGameday(await res.json());
			})
			.catch((e) => {
				if (e instanceof DOMException && e.name === 'AbortError') return;
				setError(e instanceof Error ? e.message : 'Fehler');
			});
		return () => controller.abort();
	}, [id]);

	// Generic dispatch on event type — a gameday snapshot replaces local state.
	const applySnapshot = useCallback((payload: unknown) => {
		setGameday(payload as GamedayData);
	}, []);

	const status = useGamedayEvents(id, {
		'matchup-updated': applySnapshot,
		'standings-updated': applySnapshot,
	});

	const matchups = gameday?.matchups ?? [];

	return (
		<PageContainer>
			<div className="flex items-center justify-between gap-4">
				<PageTitle>Gameday (Live)</PageTitle>
				<span className="flex items-center gap-2 text-sm text-text-muted whitespace-nowrap">
					<span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} />
					{STATUS_LABEL[status]}
				</span>
			</div>
			<PageSubtitle>{id}</PageSubtitle>

			{error && (
				<p className="text-accent-red mb-6">Gameday konnte nicht geladen werden: {error}</p>
			)}

			<SectionLabel>Matchups ({matchups.length})</SectionLabel>
			{matchups.length === 0 ? (
				<p className="text-text-secondary mb-6">Noch keine Matchups.</p>
			) : (
				<ol className="list-none flex flex-col gap-2 mb-6">
					{matchups.map((matchup) => (
						<MatchupRow key={`${matchup.player1}-${matchup.player2}`} matchup={matchup} />
					))}
				</ol>
			)}

			<ActionBar>
				<ButtonLink variant="ghost" to="/pairing">
					← Zurück zu Pairings
				</ButtonLink>
			</ActionBar>
		</PageContainer>
	);
}

function MatchupRow({ matchup }: { matchup: MatchupWithState }) {
	const { player1, player2, winner, score, active } = matchup;

	return (
		<li
			className={`flex items-center gap-3 bg-bg-card border border-border-base rounded-[10px] py-3 px-4 transition-all duration-200 ${
				active ? '' : 'opacity-40'
			}`}
		>
			<span
				className={`flex-1 ${winner === 'player1' ? 'text-accent-blue-lighter font-semibold' : 'text-text-primary'}`}
			>
				{player1}
			</span>
			<span className="text-text-muted text-sm">vs</span>
			<span
				className={`flex-1 text-right ${winner === 'player2' ? 'text-accent-gold-light font-semibold' : 'text-text-primary'}`}
			>
				{player2}
			</span>

			{score && <span className="text-sm text-text-secondary tabular-nums">{score}</span>}

			{winner ? (
				<PlayerBadge player={winner === 'player1' ? 'p1' : 'p2'}>
					🏆 {winner === 'player1' ? player1 : player2}
				</PlayerBadge>
			) : (
				<span className="text-xs text-text-muted px-2 py-1">offen</span>
			)}
		</li>
	);
}
