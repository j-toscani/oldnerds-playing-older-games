import { createFileRoute } from '@tanstack/react-router';

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

	return (
		<div className="max-w-[640px] w-full mx-auto py-12 px-6">
			<h1 className="text-4xl font-bold mb-1 text-accent-gold-light">Matchup</h1>
			<p className="text-lg text-text-secondary mb-6 tracking-tight">
				{p1} <span className="text-text-muted text-[0.85em] mx-1">vs</span> {p2}
			</p>

			<h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
				Map-Reihenfolge
			</h2>
			<ol className="list-none flex flex-col gap-2 mb-6">
				{maps.map((map, index) => (
					<li
						key={map}
						className="flex items-center gap-3 bg-bg-card border border-border-base rounded-[10px] py-3 px-4"
					>
						<span className="flex items-center justify-center w-7 h-7 bg-border-base rounded-md text-xs font-semibold shrink-0">
							{index + 1}
						</span>
						<span className="flex-1 text-base text-text-primary">{map}</span>
					</li>
				))}
			</ol>
		</div>
	);
}
