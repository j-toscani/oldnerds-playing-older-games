import { createFileRoute, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import type { GamedayData, MatchupWithState } from '@onog/shared';
import { PageContainer, PageTitle, PageSubtitle } from '../../components/layout';
import { SectionLabel, PlayerBadge } from '../../components/game-ui';
import { ButtonLink, ActionBar } from '../../components/buttons';
import { useGamedayEvents, type ConnectionStatus } from '../../lib/useGamedayEvents';
import { fetchGameday } from '../../lib/gameday';

export const Route = createFileRoute('/_unauthenticated/gameday/$id')({
	loader: ({ params }) => fetchGameday({ data: params.id }),
	pendingComponent: GamedayPending,
	errorComponent: GamedayError,
	component: GamedayLive,
});

const STATUS_LABEL: Record<ConnectionStatus, string> = {
	connecting: 'Verbinde …',
	open: 'Live',
	closed: 'Getrennt',
	failed: 'Verbindung abgebrochen',
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
	connecting: 'bg-accent-gold-light animate-pulse',
	open: 'bg-green-400',
	closed: 'bg-accent-red',
	failed: 'bg-accent-red',
};

function GamedayLive() {
	const { id } = Route.useParams();
	const loaded = Route.useLoaderData();
	const router = useRouter();

	// Two sources for the same thing: the loader holds the last *fetched*
	// snapshot, `live` the last *pushed* one. Events carry the full gameday, so
	// there is nothing to merge — the newer of the two simply wins.
	const [live, setLive] = useState<GamedayData | null>(null);
	const gameday = live ?? loaded;

	const applySnapshot = useCallback((payload: unknown) => {
		setLive(payload as GamedayData);
	}, []);

	// Events broadcast while the connection was down are not replayed (the stream
	// carries no event ids, so `Last-Event-ID` cannot resume it). Without a
	// refetch on reconnect the view would keep rendering stale data while
	// reporting "Live", so every `connected` re-runs the loader — and clears the
	// pushed snapshot afterwards, so the refetched one takes over again.
	//
	// Deliberately unconditional: the stream is shared between components, so this
	// view cannot tell whether a given `connected` is its own first one — mounting
	// onto an already-open connection means none arrives at all. Skipping "the
	// first" would therefore swallow a later, real reconnect. The cost is one
	// redundant fetch when a fresh mount opens the stream itself.
	//
	// Filtered to this route's match: re-running the root's session check on every
	// reconnect would be wasted work, and an expired session surfaces anyway —
	// `fetchGameday` redirects on a 401.
	const resync = useCallback(() => {
		void router
			.invalidate({ filter: (match) => match.routeId === Route.id })
			.then(() => setLive(null));
	}, [router]);

	const status = useGamedayEvents(id, {
		connected: resync,
		'matchup-updated': applySnapshot,
		'standings-updated': applySnapshot,
	});

	const matchups = gameday.matchups ?? [];

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

			{status === 'failed' && (
				<p className="text-accent-red mb-6">
					Live-Verbindung abgebrochen — die angezeigten Daten können veraltet sein. Lade die Seite
					neu, um es erneut zu versuchen.
				</p>
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

			<BackToPairings />
		</PageContainer>
	);
}

function GamedayPending() {
	return (
		<PageContainer>
			<PageTitle>Gameday (Live)</PageTitle>
			<p className="text-text-secondary mb-6">Lade Gameday …</p>
		</PageContainer>
	);
}

function GamedayError({ error }: ErrorComponentProps) {
	return (
		<PageContainer>
			<PageTitle>Gameday (Live)</PageTitle>
			<p className="text-accent-red mb-6">Gameday konnte nicht geladen werden: {error.message}</p>
			<BackToPairings />
		</PageContainer>
	);
}

function BackToPairings() {
	return (
		<ActionBar>
			<ButtonLink variant="ghost" to="/pairing">
				← Zurück zu Pairings
			</ButtonLink>
		</ActionBar>
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
