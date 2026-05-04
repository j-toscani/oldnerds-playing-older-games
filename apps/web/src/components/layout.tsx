import type { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
	return <div className="max-w-[640px] w-full mx-auto py-12 px-6">{children}</div>;
}

export function PageTitle({ children }: { children: ReactNode }) {
	return <h1 className="text-4xl font-bold mb-1 text-accent-gold-light">{children}</h1>;
}

export function PageSubtitle({ children }: { children: ReactNode }) {
	return <p className="text-lg text-text-secondary mb-2 tracking-tight">{children}</p>;
}

export function MatchupSubtitle({ p1, p2 }: { p1: string; p2: string }) {
	return (
		<PageSubtitle>
			{p1} <span className="text-text-muted text-[0.85em] mx-1">vs</span> {p2}
		</PageSubtitle>
	);
}
