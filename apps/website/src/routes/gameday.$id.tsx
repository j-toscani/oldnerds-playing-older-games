import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GamedayData, MatchupWithState } from '@onog/shared';
import { PageContainer, PageTitle, PageSubtitle } from '../components/layout';
import { SectionLabel, PlayerBadge } from '../components/game-ui';
import { ButtonLink, ActionBar } from '../components/buttons';
import { LoginButton } from '../components/LoginButton';
import { useGamedayEvents, type ConnectionStatus } from '../lib/useGamedayEvents';
import { api } from '../lib/api';

export const Route = createFileRoute('/gameday/$id')({
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
	const [gameday, setGameday] = useState<GamedayData | null>(null);
	const [error, setError] = useState<string | null>(null);
	// The live channel sits behind the JWT middleware. Only the snapshot fetch can
	// read the 401 — `EventSource` cannot — so authorization is decided here.
	const [unauthorized, setUnauthorized] = useState(false);

	// Fetch the full snapshot via the typed RPC client. Used for the initial load
	// and again after every reconnect — see `resync` below.
	const load = useCallback(
		async (signal?: AbortSignal) => {
			try {
				const res = await api.api.gamedays[':id'].$get(
					{ param: { id } },
					{ init: { signal } },
				);
				// Widened on purpose: the RPC client types `status` as a union of the
				// statuses the *route* declares, and the 401 comes from the JWT
				// middleware — which that type doesn't know about.
				const httpStatus: number = res.status;
				if (httpStatus === 401) {
					setUnauthorized(true);
					return;
				}
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				setUnauthorized(false);
				setGameday(await res.json());
				setError(null);
			} catch (e) {
				if (e instanceof DOMException && e.name === 'AbortError') return;
				setError(e instanceof Error ? e.message : 'Fehler');
			}
		},
		[id],
	);

	// The initial load already covers the stream's first `connected`, so only
	// later reconnects need to resync.
	const seenConnect = useRef(false);

	useEffect(() => {
		seenConnect.current = false;
		const controller = new AbortController();
		void load(controller.signal);
		return () => controller.abort();
	}, [load]);

	// Generic dispatch on event type — a gameday snapshot replaces local state.
	const applySnapshot = useCallback((payload: unknown) => {
		setGameday(payload as GamedayData);
	}, []);

	// Events broadcast while the connection was down are not replayed (the stream
	// carries no event ids, so `Last-Event-ID` cannot resume it). Without a
	// refetch on reconnect the view would keep rendering stale data while
	// reporting "Live", so treat every `connected` after the first as a resync.
	const resync = useCallback(() => {
		if (!seenConnect.current) {
			seenConnect.current = true;
			return;
		}
		void load();
	}, [load]);

	// A `null` id keeps the stream closed — no point opening a connection the
	// server will reject anyway once we know the session is missing.
	const status = useGamedayEvents(unauthorized ? null : id, {
		connected: resync,
		'matchup-updated': applySnapshot,
		'standings-updated': applySnapshot,
	});

	const matchups = gameday?.matchups ?? [];

	return (
		<PageContainer>
			<div className="flex items-center justify-between gap-4">
				<PageTitle>Gameday (Live)</PageTitle>
				{!unauthorized && (
					<span className="flex items-center gap-2 text-sm text-text-muted whitespace-nowrap">
						<span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} />
						{STATUS_LABEL[status]}
					</span>
				)}
			</div>
			<PageSubtitle>{id}</PageSubtitle>

			{unauthorized ? (
				<div className="flex flex-col items-start gap-3 mb-6">
					<p className="text-text-secondary">
						Die Live-Ansicht ist nur für eingeloggte Nutzer verfügbar.
					</p>
					<LoginButton />
				</div>
			) : (
				<>
					{error && (
						<p className="text-accent-red mb-6">Gameday konnte nicht geladen werden: {error}</p>
					)}

					{status === 'failed' && (
						<p className="text-accent-red mb-6">
							Live-Verbindung abgebrochen — die angezeigten Daten können veraltet sein. Lade die
							Seite neu, um es erneut zu versuchen.
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
				</>
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
