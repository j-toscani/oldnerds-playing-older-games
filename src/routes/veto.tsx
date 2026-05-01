import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { createInitialMapEntries } from '../lib/maps';
import type { VetoedBy } from '../lib/maps';

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
			<div className="max-w-[640px] w-full mx-auto py-12 px-6">
				<h1 className="text-4xl font-bold mb-2 text-accent-gold-light">Veto</h1>
				<p className="text-lg text-text-secondary mb-6">
					Keine Spieler angegeben. Bitte über die Pairing-Seite aufrufen.
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
			<h1 className="text-4xl font-bold mb-1 text-accent-gold-light">Map Veto</h1>
			<p className="text-lg text-text-secondary mb-2 tracking-tight">
				{p1} <span className="text-text-muted text-[0.85em] mx-1">vs</span> {p2}
			</p>

			{/* Current turn indicator */}
			{availableMaps.length > 1 && (
				<div className={`mb-6 py-4 px-5 rounded-[10px] border-2 ${
					currentTurn === 'p1'
						? 'border-accent-blue/40 bg-accent-blue/10'
						: 'border-accent-gold/40 bg-accent-gold/10'
				}`}>
					<span className="text-text-muted text-base block mb-1">Nächstes Veto</span>
					<span className={`font-bold text-2xl ${currentTurn === 'p1' ? 'text-accent-blue-lighter' : 'text-accent-gold-light'}`}>
						{currentPlayerName}
					</span>
				</div>
			)}

			{/* Available maps */}
			<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
				Verfügbare Maps ({availableMaps.length})
			</h2>
			<ol className="list-none flex flex-col gap-2 mb-6">
				{availableMaps.map((map) => (
					<li
						key={map.name}
						className="flex items-center gap-2 bg-bg-card border border-border-base rounded-[10px] transition-all duration-200 hover:border-border-hover"
					>
						<button
							type="button"
							onClick={() => handleVeto(map.name, currentTurn)}
							className="flex-1 text-base text-text-primary py-3 px-4 text-left bg-transparent border-none cursor-pointer hover:text-accent-red transition-colors duration-200"
							title={`Veto für ${currentPlayerName}`}
						>
							{map.name}
						</button>
					</li>
				))}
			</ol>

			{/* Vetoed maps */}
			{vetoedMaps.length > 0 && (
				<>
					<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
						Gebannte Maps ({vetoedMaps.length})
					</h2>
					<ol className="list-none flex flex-col gap-2 mb-6">
						{vetoedMaps.map((map) => (
							<li
								key={map.name}
								className="flex items-center gap-2 bg-bg-card border border-border-base rounded-[10px]"
							>
								<span className="flex-1 py-3 px-4 line-through text-text-muted text-base">
									{map.name}
								</span>
								<span
									className={`text-xs font-medium px-2 py-1 rounded-md ${
										map.vetoedBy === 'p1'
											? 'bg-accent-blue/15 text-accent-blue-lighter'
											: 'bg-accent-gold/15 text-accent-gold-light'
									}`}
								>
									{map.vetoedBy === 'p1' ? p1 : p2}
								</span>
								<button
									type="button"
									onClick={() => handleUndo(map.name)}
									className="px-3 py-1.5 text-xs text-accent-red hover:bg-accent-red/10 bg-transparent border-none rounded-md cursor-pointer transition-all duration-200 mr-2"
									title="Veto zurücknehmen"
								>
									↩ Undo
								</button>
							</li>
						))}
					</ol>
				</>
			)}

			{/* Action bar */}
			<div className="flex flex-wrap items-center gap-3 mt-4">
				{availableMaps.length > 0 && (
					<Link
						to="/map-order"
						search={{ p1, p2, maps: availableMaps.map((m) => m.name), starter: orderingStarter }}
						className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-[10px] text-[0.95rem] font-medium cursor-pointer transition-all duration-200 no-underline text-white bg-accent-gold hover:bg-accent-gold-light shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_4px_12px_rgba(171,107,18,0.4)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_8px_24px_rgba(171,107,18,0.5)]"
					>
						Maps sortieren →
					</Link>
				)}
				<Link
					to="/pairing"
					className="inline-flex items-center justify-center gap-2 py-3 px-5 text-text-secondary hover:text-text-primary bg-transparent border-none rounded-[10px] text-[0.95rem] font-medium transition-colors duration-200 no-underline"
				>
					← Zurück
				</Link>
			</div>
		</div>
	);
}
