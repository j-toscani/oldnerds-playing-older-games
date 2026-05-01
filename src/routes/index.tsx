import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { generateMatchups, sortMatchupsNoBackToBack } from '../lib/matchups';
import { loadGameday, saveGameday } from '../lib/storage';
import { PageContainer, PageTitle } from '../components/layout';
import { ActionBar } from '../components/buttons';

export const Route = createFileRoute('/')({
	component: PlayerInput,
});

function PlayerInput() {
	const navigate = useNavigate();
	const [playerName, setPlayerName] = useState('');
	const [players, setPlayers] = useState(() => loadGameday().players);
	const [noBackToBack, setNoBackToBack] = useState(() => loadGameday().noBackToBack);

	const addPlayer = useCallback(() => {
		const trimmed = playerName.trim();
		if (trimmed && !players.includes(trimmed)) {
			setPlayers((prev) => [...prev, trimmed]);
			setPlayerName('');
			const current = loadGameday();
			saveGameday({ ...current, players: [...current.players, trimmed] });
		}
	}, [playerName, players]);

	const removePlayer = useCallback((name: string) => {
		setPlayers((prev) => prev.filter((p) => p !== name));
		const current = loadGameday();
		saveGameday({ ...current, players: current.players.filter((p) => p !== name) });
	}, []);

	const toggleNoBackToBack = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setNoBackToBack(e.target.checked);
		const current = loadGameday();
		saveGameday({ ...current, noBackToBack: e.target.checked });
	}, []);

	const createMatchups = useCallback(() => {
		const generated = generateMatchups(players);
		const sorted = noBackToBack ? sortMatchupsNoBackToBack(generated) : generated;
		const matchups = sorted.map((m) => ({ ...m, active: true }));

		const current = loadGameday();
		saveGameday({ ...current, players, noBackToBack, matchups });

		navigate({ to: '/pairing' });
	}, [players, noBackToBack, navigate]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				addPlayer();
			}
		},
		[addPlayer],
	);

	return (
		<PageContainer>
			<PageTitle>Matchup Pairings</PageTitle>
			<p className="text-lg text-text-secondary mb-6 tracking-tight">
				Trage die Spieler ein, die heute dabei sind.
			</p>

			<div className="flex gap-2 mb-4">
				<input
					id="player-name-input"
					type="text"
					placeholder="Spielername..."
					value={playerName}
					onChange={(e) => setPlayerName(e.target.value)}
					onKeyDown={handleKeyDown}
					autoComplete="off"
					className="flex-1 py-3 px-4 bg-bg-card border border-border-base rounded-[10px] text-text-primary text-base font-[inherit] outline-none transition-colors duration-200 focus:border-accent-blue placeholder:text-text-placeholder"
				/>
				<button
					id="add-player-btn"
					type="button"
					className="inline-flex items-center justify-center gap-2 py-3 px-5 border border-border-base rounded-[10px] text-[0.95rem] font-medium cursor-pointer transition-all duration-200 text-text-primary bg-bg-elevated hover:bg-bg-hover hover:border-border-hover"
					onClick={addPlayer}
				>
					Hinzufügen
				</button>
			</div>

			{players.length > 0 && (
				<ul className="flex flex-wrap gap-2 list-none mb-6">
					{players.map((player) => (
						<li
							key={player}
							className="flex items-center gap-2 py-2 px-3 bg-bg-elevated border border-border-base rounded-lg text-sm"
						>
							<span>{player}</span>
							<button
								type="button"
								className="bg-transparent border-none text-text-muted cursor-pointer text-xs p-0 leading-none transition-colors duration-150 hover:text-accent-red"
								onClick={() => removePlayer(player)}
								aria-label={`${player} entfernen`}
							>
								✕
							</button>
						</li>
					))}
				</ul>
			)}

			<ActionBar>
				<label className="flex items-center gap-2 text-text-secondary text-sm cursor-pointer w-full mb-2">
					<input
						type="checkbox"
						checked={noBackToBack}
						onChange={toggleNoBackToBack}
						className="w-4 h-4 accent-accent-blue cursor-pointer"
					/>
					<span>Kein Spieler spielt zweimal hintereinander</span>
				</label>

				<button
					id="create-matchups-btn"
					type="button"
					className="inline-flex items-center justify-center gap-2 py-3 px-5 border-none rounded-[10px] text-[0.95rem] font-medium cursor-pointer transition-all duration-200 text-white bg-accent-gold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.24),0_4px_12px_rgba(171,107,18,0.4)] hover:not-disabled:-translate-y-px hover:not-disabled:bg-accent-gold-light hover:not-disabled:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_8px_24px_rgba(171,107,18,0.5)] disabled:opacity-40 disabled:cursor-not-allowed"
					disabled={players.length < 2}
					onClick={createMatchups}
				>
					Matchups erstellen
				</button>
			</ActionBar>
		</PageContainer>
	);
}
