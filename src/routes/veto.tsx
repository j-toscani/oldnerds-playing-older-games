import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { createInitialMapEntries } from '../lib/maps';
import type { VetoedBy } from '../lib/maps';
import { PageContainer, PageTitle, MatchupSubtitle } from '../components/layout';
import { TurnIndicator, SectionLabel, MapList, MapListItem, PlayerBadge } from '../components/game-ui';
import { ButtonLink, ActionBar } from '../components/buttons';

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
	const vetoedMaps = maps.filter((m) => m.vetoedBy !== null);

	// The player who picks maps first is the one who did NOT start vetoing
	const orderingStarter = startingPlayer === 'p1' ? 'p2' : 'p1';

	const handleVeto = useCallback((mapName: string, player: VetoedBy) => {
		setMaps((prev) => prev.map((m) => (m.name === mapName ? { ...m, vetoedBy: player } : m)));
	}, []);

	const handleUndo = useCallback((mapName: string) => {
		setMaps((prev) =>
			prev.map((m) => (m.name === mapName ? { ...m, vetoedBy: null } : m)),
		);
	}, []);

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

			{/* Available maps */}
			<SectionLabel>Verfügbare Maps ({availableMaps.length})</SectionLabel>
			<MapList>
				{availableMaps.map((map) => (
					<MapListItem key={map.name}>
						<button
							type="button"
							onClick={() => handleVeto(map.name, currentTurn)}
							className="flex-1 text-base text-text-primary py-3 px-4 text-left bg-transparent border-none cursor-pointer hover:text-accent-red transition-colors duration-200"
							title={`Veto für ${currentPlayerName}`}
						>
							{map.name}
						</button>
					</MapListItem>
				))}
			</MapList>

			{/* Vetoed maps */}
			{vetoedMaps.length > 0 && (
				<>
					<SectionLabel>Gebannte Maps ({vetoedMaps.length})</SectionLabel>
					<MapList>
						{vetoedMaps.map((map) => (
							<MapListItem key={map.name}>
								<span className="flex-1 py-3 px-4 line-through text-text-muted text-base">
									{map.name}
								</span>
								<PlayerBadge player={map.vetoedBy as 'p1' | 'p2'}>
									{map.vetoedBy === 'p1' ? p1 : p2}
								</PlayerBadge>
								<button
									type="button"
									onClick={() => handleUndo(map.name)}
									className="px-3 py-1.5 text-xs text-accent-red hover:bg-accent-red/10 bg-transparent border-none rounded-md cursor-pointer transition-all duration-200 mr-2"
									title="Veto zurücknehmen"
								>
									↩ Undo
								</button>
							</MapListItem>
						))}
					</MapList>
				</>
			)}

			{/* Action bar */}
			<ActionBar>
				{availableMaps.length > 0 && (
					<ButtonLink
						variant="primary"
						to="/map-order"
						search={{ p1, p2, maps: availableMaps.map((m) => m.name), starter: orderingStarter }}
					>
						Maps sortieren →
					</ButtonLink>
				)}
				<ButtonLink variant="ghost" to="/pairing">
					← Zurück
				</ButtonLink>
			</ActionBar>
		</PageContainer>
	);
}
