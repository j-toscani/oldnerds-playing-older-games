import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { createInitialMapEntries } from '../lib/maps';
import { PageContainer, PageTitle, MatchupSubtitle } from '../components/layout';
import {
	TurnIndicator,
	SectionLabel,
	MapList,
	MapListItem,
	PlayerBadge,
} from '../components/game-ui';
import { ButtonLink, ActionBar } from '../components/buttons';
import { Button } from '../components/Button';

type VetoSearch = {
	p1: string;
	p2: string;
};

export const Route = createFileRoute('/veto')({
	validateSearch: (search: Partial<VetoSearch>): VetoSearch => ({
		p1: search.p1 ?? '',
		p2: search.p2 ?? '',
	}),
	component: Veto,
});

function Veto() {
	const { p1, p2 } = Route.useSearch();
	const [maps, setMaps] = useState(createInitialMapEntries);
	const [startingPlayer] = useState<'p1' | 'p2'>(() => (Math.random() < 0.5 ? 'p1' : 'p2'));

	const vetoCount = maps.filter((m) => m.vetoedBy !== null).length;
	const currentTurn: 'p1' | 'p2' =
		vetoCount % 2 === 0 ? startingPlayer : startingPlayer === 'p1' ? 'p2' : 'p1';

	const currentPlayerName = currentTurn === 'p1' ? p1 : p2;
	const availableMaps = maps.filter((m) => m.vetoedBy === null);

	// The player who picks maps first is the one who did NOT start vetoing
	const orderingStarter = startingPlayer === 'p1' ? 'p2' : 'p1';

	const toggleVeto = useCallback(
		(mapName: string) => {
			setMaps((prev) =>
				prev.map((m) => {
					if (m.name !== mapName) return m;
					return { ...m, vetoedBy: m.vetoedBy ? null : currentTurn };
				}),
			);
		},
		[currentTurn],
	);

	// Guard: no players provided
	if (!p1 || !p2) {
		return (
			<PageContainer>
				<PageTitle>Veto</PageTitle>
				<p className="text-lg text-text-secondary mb-6">
					Keine Spieler angegeben. Bitte über die Pairing-Seite aufrufen.
				</p>
				<Link
					to="/pairing"
					className="text-accent-blue-lighter hover:text-accent-gold-lighter no-underline transition-colors duration-200"
				>
					← Zurück zu Pairings
				</Link>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageTitle>Map Veto</PageTitle>
			<MatchupSubtitle p1={p1} p2={p2} />

			{/* Current turn indicator */}
			{availableMaps.length > 1 && (
				<TurnIndicator label="Nächstes Veto" playerName={currentPlayerName} player={currentTurn} />
			)}

			{/* All maps */}
			<SectionLabel>Maps ({availableMaps.length} / {maps.length})</SectionLabel>
			<MapList>
				{maps.map((map) => {
					const isVetoed = map.vetoedBy !== null;

					return (
						<MapListItem key={map.name}>
							<span
								className={`flex-1 py-3 px-4 text-base ${isVetoed ? 'line-through text-text-muted' : 'text-text-primary'}`}
							>
								{map.name}
							</span>

							{isVetoed && (
								<PlayerBadge player={map.vetoedBy as 'p1' | 'p2'}>
									{map.vetoedBy === 'p1' ? p1 : p2}
								</PlayerBadge>
							)}

							<Button
								type="button"
								variant={isVetoed ? 'danger' : 'ghost'}
								size="sm"
								onClick={() => toggleVeto(map.name)}
								className="mr-2"
								title={isVetoed ? 'Veto zurücknehmen' : `Veto für ${currentPlayerName}`}
							>
								{isVetoed ? '↩ Undo' : 'Veto'}
							</Button>
						</MapListItem>
					);
				})}
			</MapList>

			{/* Action bar */}
			<ActionBar>
				<ButtonLink variant="ghost" to="/pairing">
					← Zurück
				</ButtonLink>
				{availableMaps.length > 0 && (
					<ButtonLink
						variant="primary"
						to="/map-order"
						search={{ p1, p2, maps: availableMaps.map((m) => m.name), starter: orderingStarter }}
					>
						Maps sortieren →
					</ButtonLink>
				)}
			</ActionBar>
		</PageContainer>
	);
}

