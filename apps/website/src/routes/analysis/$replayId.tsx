import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { ReplayData } from '@onog/shared';
import { PageContainer, PageTitle, PageSubtitle } from '../../components/layout';
import { ActionBar, ButtonLink } from '../../components/buttons';
import { getReplay } from '../../lib/replay-db';
import { formatPlayedAt } from '../../lib/replay-format';

export const Route = createFileRoute('/analysis/$replayId')({
	component: ReplayDetail,
});

type DetailState =
	| { status: 'loading' }
	| { status: 'found'; replay: ReplayData }
	| { status: 'not-found' }
	| { status: 'error' };

function BackLink() {
	return (
		<ButtonLink variant="ghost" className="pl-0" to="/analysis">
			← Zurück zur Übersicht
		</ButtonLink>
	);
}

function JsonBlock({ data }: { data: unknown }) {
	return (
		<div className="overflow-x-auto bg-bg-card border border-border-base rounded-[10px]">
			<pre className="p-4 text-xs leading-relaxed text-text-secondary">{JSON.stringify(data, null, 2)}</pre>
		</div>
	);
}

/** Metadata first; the tracker events are hundreds of KB, so they sit collapsed below */
function ReplayJson({ replay }: { replay: ReplayData }) {
	const { trackerEvents, ...metadata } = replay;

	return (
		<>
			<PageTitle>{replay.map}</PageTitle>
			<PageSubtitle>{formatPlayedAt(replay.playedAt)}</PageSubtitle>
			<div className="mt-6">
				<JsonBlock data={metadata} />
			</div>
			<details className="mt-6">
				<summary className="cursor-pointer text-sm font-semibold text-text-muted uppercase tracking-wider mb-3 hover:text-text-primary transition-colors duration-200">
					Tracker-Events ({trackerEvents.length})
				</summary>
				<JsonBlock data={trackerEvents} />
			</details>
		</>
	);
}

function ReplayDetail() {
	const { replayId } = Route.useParams();
	// The data exists only in this browser's IndexedDB, so the server always
	// renders the loading state and the client fills in the rest.
	const [state, setState] = useState<DetailState>({ status: 'loading' });

	useEffect(() => {
		let cancelled = false;
		getReplay(replayId).then(
			(replay) => {
				if (!cancelled) setState(replay ? { status: 'found', replay } : { status: 'not-found' });
			},
			(error: unknown) => {
				console.error('Failed to read replay', replayId, error);
				if (!cancelled) setState({ status: 'error' });
			},
		);
		return () => {
			cancelled = true;
		};
	}, [replayId]);

	return (
		<PageContainer>
			<ActionBar>
				<BackLink />
			</ActionBar>

			{state.status === 'loading' && <p className="text-text-muted mt-6">Replay wird geladen …</p>}

			{state.status === 'not-found' && (
				<>
					<PageTitle>Replay nicht gefunden</PageTitle>
					<p className="text-lg text-text-secondary mb-6">
						Dieses Replay ist nicht in der Bibliothek dieses Browsers. Replays werden nur lokal gespeichert –
						ein Link funktioniert deshalb nicht auf anderen Geräten oder in anderen Browsern, und gelöschte
						Replays sind weg.
					</p>
				</>
			)}

			{state.status === 'error' && (
				<>
					<PageTitle>Replay konnte nicht geladen werden</PageTitle>
					<p className="text-lg text-text-secondary mb-6">
						Die lokale Bibliothek ist nicht lesbar. Möglicherweise blockiert dein Browser den lokalen Speicher
						(z. B. im privaten Modus).
					</p>
				</>
			)}

			{state.status === 'found' && <ReplayJson replay={state.replay} />}
		</PageContainer>
	);
}
