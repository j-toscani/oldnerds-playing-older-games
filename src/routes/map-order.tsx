import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';

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

	// Pool: maps not yet placed in order
	const [pool, setPool] = useState<string[]>(initialMaps);
	// Ordered: maps placed by players in order
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
			<div className="max-w-[640px] w-full mx-auto py-12 px-6">
				<h1 className="text-4xl font-bold mb-2 text-accent-gold-light">Map-Reihenfolge</h1>
				<p className="text-lg text-text-secondary mb-6">
					Keine Maps vorhanden. Bitte über die Veto-Seite aufrufen.
				</p>
				<Link
					to="/pairing"
					className="text-accent-blue-lighter hover:text-accent-gold-lighter no-underline transition-colors duration-200"
				>
					← Zurück zu Pairings
				</Link>
			</div>
		);
	}

	return (
		<div className="max-w-[640px] w-full mx-auto py-12 px-6">
			<h1 className="text-4xl font-bold mb-1 text-accent-gold-light">Map-Reihenfolge</h1>
			<p className="text-lg text-text-secondary mb-2 tracking-tight">
				{p1} <span className="text-text-muted text-[0.85em] mx-1">vs</span> {p2}
			</p>

			{/* Current turn indicator */}
			{pool.length > 0 && (
				<div
					className={`mb-6 py-4 px-5 rounded-[10px] border-2 ${
						currentTurn === 'p1'
							? 'border-accent-blue/40 bg-accent-blue/10'
							: 'border-accent-gold/40 bg-accent-gold/10'
					}`}
				>
					<span className="text-text-muted text-base block mb-1">Nächste Map wählt</span>
					<span
						className={`font-bold text-2xl ${currentTurn === 'p1' ? 'text-accent-blue-lighter' : 'text-accent-gold-light'}`}
					>
						{currentPlayerName}
					</span>
				</div>
			)}

			{/* Ordered maps */}
			<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
				Reihenfolge ({ordered.length})
			</h2>
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

			{/* Pool: available maps to pick from */}
			{pool.length > 0 && (
				<>
					<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
						Verfügbare Maps ({pool.length})
					</h2>
					<ol className="list-none flex flex-col gap-2 mb-6">
						{pool.map((name) => (
							<li
								key={name}
								className="flex items-center bg-bg-card border border-border-base rounded-[10px] transition-all duration-200 hover:border-border-hover"
							>
								<button
									type="button"
									onClick={() => handleClickAdd(name)}
									className="flex-1 text-base text-text-primary py-3 px-4 text-left bg-transparent border-none cursor-pointer hover:text-accent-gold-light transition-colors duration-200"
								>
									{name}
								</button>
							</li>
						))}
					</ol>
				</>
			)}

			{/* Action bar */}
			<div className="flex flex-wrap items-center gap-3 mt-4">
				{matchupMaps.length > 0 && (
					<Link
						to="/matchup"
						search={{ p1, p2, maps: matchupMaps }}
						className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-[10px] text-[0.95rem] font-medium cursor-pointer transition-all duration-200 no-underline text-white bg-accent-gold hover:bg-accent-gold-light shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(171,107,18,0.4)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_8px_24px_rgba(171,107,18,0.5)]"
					>
						Matchup starten →
					</Link>
				)}
				<Link
					to="/veto"
					search={{ p1, p2 }}
					className="inline-flex items-center justify-center gap-2 py-3 px-5 text-text-secondary hover:text-text-primary bg-transparent border-none rounded-[10px] text-[0.95rem] font-medium transition-colors duration-200 no-underline"
				>
					← Zurück zum Veto
				</Link>
			</div>
		</div>
	);
}
