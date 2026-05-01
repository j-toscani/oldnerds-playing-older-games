import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect, useRef } from 'react';
import { PageContainer, PageTitle, MatchupSubtitle } from '../components/layout';
import { SectionLabel, PlayerBadge } from '../components/game-ui';
import { ButtonLink, ActionBar } from '../components/buttons';
import { launchConfetti } from '../lib/confetti';

type MapResult = 'p1' | 'p2' | null;

type MatchupSearch = {
	p1: string;
	p2: string;
	maps: string[];
};

export const Route = createFileRoute('/matchup')({
	validateSearch: (search: Partial<MatchupSearch>): MatchupSearch => ({
		p1: search.p1 ?? '',
		p2: search.p2 ?? '',
		maps: Array.isArray(search.maps) ? search.maps : [],
	}),
	component: Matchup,
});

function Matchup() {
	const { p1, p2, maps } = Route.useSearch();
	const [results, setResults] = useState<MapResult[]>(() => maps.map(() => null));
	const confettiFired = useRef(false);

	const winsNeeded = Math.ceil(maps.length / 2);
	const p1Wins = results.filter((r) => r === 'p1').length;
	const p2Wins = results.filter((r) => r === 'p2').length;
	const winner: 'p1' | 'p2' | null =
		p1Wins >= winsNeeded ? 'p1' : p2Wins >= winsNeeded ? 'p2' : null;
	const winnerName = winner === 'p1' ? p1 : winner === 'p2' ? p2 : null;

	useEffect(() => {
		if (winner && !confettiFired.current) {
			confettiFired.current = true;
			launchConfetti();
		}
		if (!winner) {
			confettiFired.current = false;
		}
	}, [winner]);

	const handleSetResult = useCallback((index: number, player: 'p1' | 'p2') => {
		setResults((prev) => {
			const next = [...prev];
			// Toggle: clicking the same player clears the result
			next[index] = next[index] === player ? null : player;
			return next;
		});
	}, []);

	if (!p1 || !p2 || maps.length === 0) {
		return (
			<PageContainer>
				<PageTitle>Matchup</PageTitle>
				<p className="text-lg text-text-secondary mb-6">
					Kein Matchup vorhanden. Bitte über die Pairing-Seite aufrufen.
				</p>
				<ButtonLink variant="ghost" to="/pairing">
					← Zurück zu Pairings
				</ButtonLink>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageTitle>Matchup</PageTitle>
			<MatchupSubtitle p1={p1} p2={p2} />

			{/* Score */}
			<div className="flex items-center justify-center gap-4 mb-6 py-5 px-6 bg-bg-card border border-border-base rounded-[10px]">
				<div className="flex flex-col items-center gap-1">
					<span className={`text-sm font-medium ${winner === 'p1' ? 'text-accent-blue-lighter' : 'text-text-muted'}`}>
						{p1}
					</span>
					<span className={`text-4xl font-bold ${p1Wins > p2Wins ? 'text-accent-blue-lighter' : 'text-text-primary'}`}>
						{p1Wins}
					</span>
				</div>
				<span className="text-2xl text-text-muted font-light">:</span>
				<div className="flex flex-col items-center gap-1">
					<span className={`text-sm font-medium ${winner === 'p2' ? 'text-accent-gold-light' : 'text-text-muted'}`}>
						{p2}
					</span>
					<span className={`text-4xl font-bold ${p2Wins > p1Wins ? 'text-accent-gold-light' : 'text-text-primary'}`}>
						{p2Wins}
					</span>
				</div>
			</div>

			{/* Winner banner */}
			{winner && winnerName && (
				<div
					className={`mb-6 py-5 px-5 rounded-[10px] border-2 text-center ${
						winner === 'p1'
							? 'border-accent-blue/50 bg-accent-blue/15'
							: 'border-accent-gold/50 bg-accent-gold/15'
					}`}
				>
					<span className="text-3xl mb-2 block">🏆</span>
					<span
						className={`font-bold text-2xl ${
							winner === 'p1' ? 'text-accent-blue-lighter' : 'text-accent-gold-light'
						}`}
					>
						{winnerName} gewinnt!
					</span>
					<p className="text-text-muted text-sm mt-1">
						Best of {maps.length} · {p1Wins}:{p2Wins}
					</p>
				</div>
			)}

			{/* Map list */}
			<SectionLabel>
				Maps ({maps.length}) · Bo{maps.length}
			</SectionLabel>
			<ol className="list-none flex flex-col gap-2 mb-6">
				{maps.map((map, index) => {
					const result = results[index];
					const isDecided = result !== null;
					const isLocked = winner !== null && !isDecided;

					return (
						<li
							key={map}
							className={`flex items-center gap-3 rounded-[10px] py-3 px-4 transition-all duration-200 ${
								result === 'p1'
									? 'bg-accent-blue/10 border border-accent-blue/30'
									: result === 'p2'
										? 'bg-accent-gold/10 border border-accent-gold/30'
										: 'bg-bg-card border border-border-base'
							} ${isLocked ? 'opacity-30' : ''}`}
						>
							<span
								className={`flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold shrink-0 ${
									result === 'p1'
										? 'bg-accent-blue/20 text-accent-blue-lighter'
										: result === 'p2'
											? 'bg-accent-gold/20 text-accent-gold-light'
											: 'bg-border-base text-text-muted'
								}`}
							>
								{index + 1}
							</span>

							<span className={`flex-1 text-base ${isDecided ? 'text-text-primary' : 'text-text-secondary'}`}>
								{map}
							</span>

							{/* Winner badge for decided maps */}
							{isDecided && (
								<PlayerBadge player={result}>
									{result === 'p1' ? p1 : p2}
								</PlayerBadge>
							)}

							{/* Action buttons */}
							{!isLocked && (
								<div className="flex gap-1">
									<button
										type="button"
										onClick={() => handleSetResult(index, 'p1')}
										className={`px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer border-none transition-all duration-200 ${
											result === 'p1'
												? 'bg-accent-blue/30 text-accent-blue-lighter'
												: 'bg-bg-elevated text-text-muted hover:bg-accent-blue/20 hover:text-accent-blue-lighter'
										}`}
										title={`${p1} gewinnt`}
									>
										{p1}
									</button>
									<button
										type="button"
										onClick={() => handleSetResult(index, 'p2')}
										className={`px-2.5 py-1.5 text-xs font-medium rounded-md cursor-pointer border-none transition-all duration-200 ${
											result === 'p2'
												? 'bg-accent-gold/30 text-accent-gold-light'
												: 'bg-bg-elevated text-text-muted hover:bg-accent-gold/20 hover:text-accent-gold-light'
										}`}
										title={`${p2} gewinnt`}
									>
										{p2}
									</button>
								</div>
							)}
						</li>
					);
				})}
			</ol>

			<ActionBar>
				<ButtonLink variant="ghost" to="/pairing">
					← Zurück zu Pairings
				</ButtonLink>
			</ActionBar>
		</PageContainer>
	);
}
