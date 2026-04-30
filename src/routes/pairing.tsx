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
		<div className="pairing-page">
			<h1>Matchups</h1>
			<p className="tagline">
				{matchups.filter((m) => m.active).length} aktive Matchups von {matchups.length} gesamt
			</p>

			<ol className="matchup-list">
				{matchups.map((matchup, index) => (
					<li
						key={`${matchup.player1}-${matchup.player2}`}
						className={`matchup-item ${!matchup.active ? 'deactivated' : ''}`}
					>
						<button
							type="button"
							className="matchup-toggle"
							onClick={() => toggleMatchup(index)}
							aria-label={matchup.active ? 'Matchup deaktivieren' : 'Matchup aktivieren'}
						>
							<span className="matchup-number">{index + 1}</span>
							<span className="matchup-players">
								{matchup.player1} <span className="vs">vs</span> {matchup.player2}
							</span>
							<span className="matchup-status">{matchup.active ? '✓' : '✕'}</span>
						</button>
						{matchup.active && (
							<Link
								to="/veto"
								search={{ p1: matchup.player1, p2: matchup.player2 }}
								className="btn btn-veto"
							>
								Veto →
							</Link>
						)}
					</li>
				))}
			</ol>

			<div className="controls">
				<button id="reshuffle-btn" type="button" className="btn btn-secondary" onClick={reshuffle}>
					🔀 Neu mischen
				</button>
				<Link to="/" className="btn btn-ghost">
					← Zurück
				</Link>
			</div>
		</div>
	);
}
