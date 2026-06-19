import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { generateMatchups, sortMatchupsNoBackToBack } from '../lib/matchups';
import { loadGameday, saveGameday } from '../lib/storage';
import { PageContainer, PageTitle } from '../components/layout';
import { ActionBar } from '../components/buttons';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';

export const Route = createFileRoute('/')({
	validateSearch: ({ players }: Partial<{ players: string[] }>) => {
		return { players: players ?? [] };
	},
	component: PlayerInput,
});

function PlayerInput() {
	const navigate = useNavigate();
	const { players: initialPlayers } = Route.useSearch();
	const [playerName, setPlayerName] = useState('');
	const [players, setPlayers] = useState(() => initialPlayers);
	const [noBackToBack, setNoBackToBack] = useState(true);

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
				<Button
					id="add-player-btn"
					type="button"
					variant="secondary"
					size="lg"
					onClick={addPlayer}
				>
					Hinzufügen
				</Button>
			</div>

			{players.length > 0 && (
				<ul className="flex flex-wrap gap-2 list-none mb-6">
					{players.map((player) => (
						<li
							key={player}
							className="flex items-center gap-2 py-2 px-3 bg-bg-elevated border border-border-base rounded-lg text-sm"
						>
							<span>{player}</span>
							<IconButton
								variant="danger"
								size="sm"
								onClick={() => removePlayer(player)}
								label={`${player} entfernen`}
							>
								✕
							</IconButton>
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

				<Button
					id="create-matchups-btn"
					type="button"
					variant="primary"
					size="lg"
					disabled={players.length < 2}
					onClick={createMatchups}
				>
					Matchups erstellen
				</Button>
			</ActionBar>
		</PageContainer>
	);
}
