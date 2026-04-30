import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { sortMatchupsNoBackToBack, sortWithDeactivatedLast } from '../lib/matchups';
import { loadGameday, saveGameday } from '../lib/storage';

export const Route = createFileRoute('/pairing')({
	component: PairingMatchups,
});

function PairingMatchups() {
	const [matchups, setMatchups] = useState(() => loadGameday().matchups ?? []);
	const [noBackToBack] = useState(() => loadGameday().noBackToBack);

	const toggleMatchup = useCallback((index: number) => {
		setMatchups((prev) => {
			const updated = prev.map((m, i) => (i === index ? { ...m, active: !m.active } : m));
			const current = loadGameday();
			saveGameday({ ...current, matchups: updated });
			return sortWithDeactivatedLast(updated);
		});
	}, []);

	const reshuffle = useCallback(() => {
		const active = matchups.filter((m) => m.active);
		const deactivated = matchups.filter((m) => !m.active);
		const reshuffled = noBackToBack ? sortMatchupsNoBackToBack(active) : active;
		const updated = [...reshuffled.map((m) => ({ ...m, active: true })), ...deactivated];
		setMatchups(updated);
		const current = loadGameday();
		saveGameday({ ...current, matchups: updated });
	}, [matchups, noBackToBack]);

	if (matchups.length === 0) return null;

	return (
		<div className="max-w-[640px] w-full mx-auto py-12 px-6">
			<h1 className="text-4xl font-bold mb-1 bg-linear-to-br from-accent-purple-light via-accent-pink-light to-accent-orange bg-clip-text text-transparent">
				Matchups
			</h1>
			<p className="text-lg text-text-secondary mb-6 tracking-tight">
				{matchups.filter((m) => m.active).length} aktive Matchups von {matchups.length} gesamt
			</p>

			<ol className="list-none flex flex-col gap-2 mb-6">
				{matchups.map((matchup, index) => (
					<li
						key={`${matchup.player1}-${matchup.player2}`}
						className={`flex items-center gap-2 bg-bg-card border border-border-base rounded-[10px] transition-all duration-200 hover:border-border-hover ${!matchup.active ? 'opacity-40' : ''}`}
					>
						<button
							type="button"
							className="flex-1 flex items-center gap-3 bg-transparent border-none text-text-primary cursor-pointer py-3 px-4 text-base font-[inherit] text-left"
							onClick={() => toggleMatchup(index)}
							aria-label={matchup.active ? 'Matchup deaktivieren' : 'Matchup aktivieren'}
						>
							<span className="flex items-center justify-center w-7 h-7 bg-border-base rounded-md text-xs font-semibold shrink-0">
								{index + 1}
							</span>
							<span className={`flex-1 ${!matchup.active ? 'line-through' : ''}`}>
								{matchup.player1} <span className="text-text-muted text-[0.85em] mx-1">vs</span>{' '}
								{matchup.player2}
							</span>
							<span className="text-sm text-text-muted">{matchup.active ? '✓' : '✕'}</span>
						</button>
						{matchup.active && (
							<Link
								to="/veto"
								search={{ p1: matchup.player1, p2: matchup.player2 }}
								className="text-accent-purple-light hover:text-accent-purple-lighter hover:bg-accent-purple-light/10 bg-transparent py-2 px-3 text-sm no-underline whitespace-nowrap rounded-[10px] transition-all duration-200"
							>
								Veto →
							</Link>
						)}
					</li>
				))}
			</ol>

			<div className="flex flex-wrap items-center gap-3 mt-2">
				<button
					id="reshuffle-btn"
					type="button"
					className="inline-flex items-center justify-center gap-2 py-3 px-5 border border-border-base rounded-[10px] text-[0.95rem] font-medium cursor-pointer transition-all duration-200 text-text-primary bg-bg-elevated hover:bg-bg-hover hover:border-border-hover"
					onClick={reshuffle}
				>
					🔀 Neu mischen
				</button>
				<Link
					to="/"
					className="inline-flex items-center justify-center gap-2 py-3 px-5 text-text-secondary hover:text-text-primary bg-transparent border-none rounded-[10px] text-[0.95rem] font-medium transition-colors duration-200 no-underline"
				>
					← Zurück
				</Link>
			</div>
		</div>
	);
}
