import { createFileRoute } from '@tanstack/react-router';
import { PageContainer, PageTitle, MatchupSubtitle } from '../components/layout';
import { SectionLabel } from '../components/game-ui';
import { ButtonLink, ActionBar } from '../components/buttons';

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
		<PageContainer>
			<PageTitle>Matchup</PageTitle>
			<MatchupSubtitle p1={p1} p2={p2} />

			<SectionLabel>Map-Reihenfolge</SectionLabel>
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

			<ActionBar>
				<ButtonLink variant="ghost" to="/pairing">
					← Zurück zu Pairings
				</ButtonLink>
			</ActionBar>
		</PageContainer>
	);
}
