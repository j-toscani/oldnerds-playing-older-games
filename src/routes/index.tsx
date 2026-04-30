import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { generateMatchups, sortMatchupsNoBackToBack } from '../lib/matchups';
import { loadGameday, saveGameday } from '../lib/storage';

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
		<div className="pairing-page">
			<h1>Matchup Pairings</h1>
			<p className="tagline">Trage die Spieler ein, die heute dabei sind.</p>

			<div className="player-input">
				<input
					id="player-name-input"
					type="text"
					placeholder="Spielername..."
					value={playerName}
					onChange={(e) => setPlayerName(e.target.value)}
					onKeyDown={handleKeyDown}
					autoComplete="off"
				/>
				<button id="add-player-btn" type="button" className="btn btn-secondary" onClick={addPlayer}>
					Hinzufügen
				</button>
			</div>

			{players.length > 0 && (
				<ul className="player-list">
					{players.map((player) => (
						<li key={player} className="player-chip">
							<span>{player}</span>
							<button
								type="button"
								className="chip-remove"
								onClick={() => removePlayer(player)}
								aria-label={`${player} entfernen`}
							>
								✕
							</button>
						</li>
					))}
				</ul>
			)}

			<div className="controls">
				<label className="checkbox-label">
					<input type="checkbox" checked={noBackToBack} onChange={toggleNoBackToBack} />
					<span>Kein Spieler spielt zweimal hintereinander</span>
				</label>

				<button
					id="create-matchups-btn"
					type="button"
					className="btn btn-primary"
					disabled={players.length < 2}
					onClick={createMatchups}
				>
					Matchups erstellen
				</button>
			</div>
		</div>
	);
}
