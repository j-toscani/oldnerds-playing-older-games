import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { PageContainer, PageTitle, MatchupSubtitle } from '../components/layout';
import { TurnIndicator, SectionLabel, MapList, MapListItem } from '../components/game-ui';
import { ButtonLink, ActionBar } from '../components/buttons';

type OrderedMap = {
	name: string;
	pickedBy: 'p1' | 'p2';
};

type MapOrderSearch = {
	p1: string;
	p2: string;
	maps: string[];
	starter: 'p1' | 'p2';
};

export const Route = createFileRoute('/map-order')({
	validateSearch: (search: Partial<MapOrderSearch>): MapOrderSearch => ({
		p1: search.p1 ?? '',
		p2: search.p2 ?? '',
		maps: search.maps ?? [],
		starter: search.starter ?? 'p1',
	}),
	component: MapOrder,
});

function MapOrder() {
	const { p1, p2, maps: initialMaps, starter } = Route.useSearch();

	const [pool, setPool] = useState<string[]>(initialMaps);
	const [ordered, setOrdered] = useState<OrderedMap[]>([]);

	const currentTurn: 'p1' | 'p2' =
		ordered.length % 2 === 0 ? starter : starter === 'p1' ? 'p2' : 'p1';
	const currentPlayerName = currentTurn === 'p1' ? p1 : p2;

	const handleRemoveFromOrdered = useCallback((mapName: string) => {
		setOrdered((prev) => prev.filter((m) => m.name !== mapName));
		setPool((prev) => [...prev, mapName]);
	}, []);

	const handleClickAdd = useCallback(
		(mapName: string) => {
			setPool((prev) => prev.filter((m) => m !== mapName));
			setOrdered((prev) => [...prev, { name: mapName, pickedBy: currentTurn }]);
		},
		[currentTurn],
	);

	const matchupMaps = ordered.length > 0 ? ordered.map((m) => m.name) : [];

	if (!p1 || !p2 || initialMaps.length === 0) {
		return (
			<PageContainer>
				<PageTitle>Map-Reihenfolge</PageTitle>
				<p className="text-lg text-text-secondary mb-6">
					Keine Maps vorhanden. Bitte über die Veto-Seite aufrufen.
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
			<PageTitle>Map-Reihenfolge</PageTitle>
			<MatchupSubtitle p1={p1} p2={p2} />

			{pool.length > 0 && (
				<TurnIndicator label="Nächste Map wählt" playerName={currentPlayerName} player={currentTurn} />
			)}

			{/* Ordered maps */}
			<SectionLabel>Reihenfolge ({ordered.length})</SectionLabel>
			<div
				className={`min-h-[80px] mb-6 rounded-[10px] ${ordered.length === 0 ? 'flex items-center justify-center border-2 border-dashed border-border-base bg-bg-card/50' : ''}`}
			>
				{ordered.length === 0 ? (
					<p className="text-text-muted text-sm py-6">
						Maps unten anklicken um die Reihenfolge festzulegen
					</p>
				) : (
					<ol className="list-none flex flex-col gap-2 p-3">
						{ordered.map((entry, index) => (
							<li
								key={entry.name}
								className={`flex items-center gap-3 rounded-[10px] py-3 px-4 ${
									entry.pickedBy === 'p1' ? 'bg-accent-blue/10' : 'bg-accent-gold/10'
								}`}
							>
								<span
									className={`flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold shrink-0 ${
										entry.pickedBy === 'p1'
											? 'bg-accent-blue/20 text-accent-blue-lighter'
											: 'bg-accent-gold/20 text-accent-gold-light'
									}`}
								>
									{index + 1}
								</span>
								<span className="flex-1 text-base text-text-primary">{entry.name}</span>
								<button
									type="button"
									onClick={() => handleRemoveFromOrdered(entry.name)}
									className="px-2.5 py-1.5 text-xs text-accent-red hover:bg-accent-red/10 bg-transparent border-none rounded-md cursor-pointer transition-all duration-200"
									title="Zurück in den Pool"
								>
									✕
								</button>
							</li>
						))}
					</ol>
				)}
			</div>

			{/* Pool */}
			{pool.length > 0 && (
				<>
					<SectionLabel>Verfügbare Maps ({pool.length})</SectionLabel>
					<MapList>
						{pool.map((name) => (
							<MapListItem key={name}>
								<button
									type="button"
									onClick={() => handleClickAdd(name)}
									className="flex-1 text-base text-text-primary py-3 px-4 text-left bg-transparent border-none cursor-pointer hover:text-accent-gold-light transition-colors duration-200"
								>
									{name}
								</button>
							</MapListItem>
						))}
					</MapList>
				</>
			)}

			<ActionBar>
				{matchupMaps.length > 0 && (
					<ButtonLink variant="primary" to="/matchup" search={{ p1, p2, maps: matchupMaps }}>
						Matchup starten →
					</ButtonLink>
				)}
				<ButtonLink variant="ghost" to="/veto" search={{ p1, p2 }}>
					← Zurück zum Veto
				</ButtonLink>
			</ActionBar>
		</PageContainer>
	);
}
