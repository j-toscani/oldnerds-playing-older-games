import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router';
import type { MatchupWithState } from '@onog/shared';
import { PageContainer, PageTitle, PageSubtitle } from '../../components/layout';
import { SectionLabel, PlayerBadge } from '../../components/game-ui';
import { ButtonLink, ActionBar } from '../../components/buttons';
import { fetchGameday } from '../../lib/gameday';

export const Route = createFileRoute('/_unauthenticated/gameday/$id')({
	loader: ({ params }) => fetchGameday({ data: params.id }),
	pendingComponent: GamedayPending,
	errorComponent: GamedayError,
	component: GamedayDetail,
});

function GamedayDetail() {
	const { id } = Route.useParams();
	const gameday = Route.useLoaderData();

	const matchups = gameday.matchups ?? [];

	return (
		<PageContainer>
			<PageTitle>Gameday</PageTitle>
			<PageSubtitle>{id}</PageSubtitle>

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
			<PageTitle>Gameday</PageTitle>
			<p className="text-text-secondary mb-6">Lade Gameday …</p>
		</PageContainer>
	);
}

function GamedayError({ error }: ErrorComponentProps) {
	return (
		<PageContainer>
			<PageTitle>Gameday</PageTitle>
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
