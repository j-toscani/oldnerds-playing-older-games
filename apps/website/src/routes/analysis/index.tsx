import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import type { ReplayData } from '@onog/shared';
import { PageContainer, PageTitle, PageSubtitle } from '../../components/layout';
import { SectionLabel } from '../../components/game-ui';
import { Button } from '../../components/Button';
import { FilePicker, ImportProgress, InlineConfirm, ReplayTable } from '../../components/replay-library';
import { clearReplays, createReplayId, deleteReplay, listReplays, saveReplay } from '../../lib/replay-db';
import { importReplayFiles, requestPersistentStorage, type FileImport } from '../../lib/replay-import';
import { loadReplayParser } from '../../lib/replay-parser';
import { createLibraryZip, downloadFileName, libraryZipFileName, toReplayDownload } from '../../lib/replay-download';

export const Route = createFileRoute('/analysis/')({
	component: Analysis,
});

type ParserState = 'loading' | 'ready' | 'error';
type Notice = { tone: 'info' | 'error'; text: string } | null;

function useReplayParser() {
	const [state, setState] = useState<ParserState>('loading');

	// Loaded on mount rather than on file selection, so picking and analysing
	// files doesn't trigger a single network request.
	useEffect(() => {
		let cancelled = false;
		loadReplayParser().then(
			() => !cancelled && setState('ready'),
			(error: unknown) => {
				console.error('Failed to load replay parser', error);
				if (!cancelled) setState('error');
			},
		);
		return () => {
			cancelled = true;
		};
	}, []);

	return state;
}

function useReplayLibrary() {
	const [replays, setReplays] = useState<ReplayData[] | null>(null);
	const [error, setError] = useState(false);

	const reload = useCallback(async () => {
		try {
			setReplays(await listReplays());
			setError(false);
		} catch (err) {
			console.error('Failed to read replay library', err);
			setError(true);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		listReplays().then(
			(list) => !cancelled && setReplays(list),
			(err: unknown) => {
				console.error('Failed to read replay library', err);
				if (!cancelled) setError(true);
			},
		);
		return () => {
			cancelled = true;
		};
	}, []);

	return { replays, error, reload };
}

function downloadBlob(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}

function Analysis() {
	const parserState = useReplayParser();
	const { replays, error: libraryError, reload } = useReplayLibrary();
	const [imports, setImports] = useState<FileImport[]>([]);
	const [busy, setBusy] = useState(false);
	const [confirmingClear, setConfirmingClear] = useState(false);
	const [notice, setNotice] = useState<Notice>(null);

	const handleReplayFiles = async (files: File[]) => {
		setBusy(true);
		setNotice(null);
		try {
			const parse = await loadReplayParser();
			await importReplayFiles(files, {
				parse,
				save: saveReplay,
				createId: createReplayId,
				now: () => new Date(),
				onProgress: setImports,
				onFirstSave: () => void requestPersistentStorage(),
			});
		} catch (err) {
			console.error('Replay import failed', err);
			setNotice({ tone: 'error', text: 'Die Replays konnten nicht analysiert werden.' });
		} finally {
			await reload();
			setBusy(false);
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await deleteReplay(id);
		} catch (err) {
			console.error('Failed to delete replay', err);
			setNotice({ tone: 'error', text: 'Das Replay konnte nicht gelöscht werden.' });
		}
		await reload();
	};

	const handleClear = async () => {
		setConfirmingClear(false);
		try {
			await clearReplays();
			setImports([]);
		} catch (err) {
			console.error('Failed to clear replay library', err);
			setNotice({ tone: 'error', text: 'Die Bibliothek konnte nicht geleert werden.' });
		}
		await reload();
	};

	const handleDownload = (replay: ReplayData) => {
		const json = JSON.stringify(toReplayDownload(replay), null, 2);
		downloadBlob(new Blob([json], { type: 'application/json' }), downloadFileName(replay));
	};

	const handleDownloadAll = async () => {
		if (!replays) return;
		setBusy(true);
		setNotice(null);
		try {
			const zip = await createLibraryZip(replays);
			downloadBlob(new Blob([zip], { type: 'application/zip' }), libraryZipFileName(new Date()));
		} catch (err) {
			console.error('Failed to create replay zip', err);
			setNotice({ tone: 'error', text: 'Das ZIP-Archiv konnte nicht erstellt werden.' });
		} finally {
			setBusy(false);
		}
	};

	const isEmpty = replays !== null && replays.length === 0;

	return (
		<PageContainer>
			<PageTitle>Replays auslesen</PageTitle>
			<PageSubtitle>Lies deine StarCraft-II-Replays aus und sammle sie als strukturierte Daten in deiner Bibliothek.</PageSubtitle>
			<p className="text-sm text-text-muted mb-8">
				Die Dateien werden direkt in deinem Browser ausgelesen und verlassen dein Gerät nicht. Die Bibliothek
				liegt nur in diesem Browser: Auf anderen Geräten ist sie nicht verfügbar, und wer den Browser-Speicher
				leert, löscht sie mit.
			</p>

			<section className="mb-10">
				<FilePicker
					id="replay-files"
					label="Replay-Dateien auswählen (.SC2Replay, auch mehrere)"
					accept=".SC2Replay"
					multiple
					variant="primary"
					disabled={busy || parserState !== 'ready'}
					onFiles={handleReplayFiles}
				/>
				{parserState === 'loading' && <p className="text-sm text-text-muted mt-2">Parser wird geladen …</p>}
				{parserState === 'error' && (
					<p className="text-sm text-accent-red mt-2">
						Der Replay-Parser konnte nicht geladen werden. Bitte lade die Seite neu.
					</p>
				)}
				{imports.length > 0 && <ImportProgress imports={imports} />}
			</section>

			<section>
				<SectionLabel>Deine Bibliothek{replays && replays.length > 0 ? ` (${replays.length})` : ''}</SectionLabel>

				{notice && (
					<p role="status" className={`text-sm mb-3 ${notice.tone === 'error' ? 'text-accent-red' : 'text-text-secondary'}`}>
						{notice.text}
					</p>
				)}

				{replays && replays.length > 0 && !confirmingClear && (
					<div className="flex flex-wrap justify-between gap-2 mb-3">
						<Button type="button" variant="outlined" size="sm" onClick={handleDownloadAll} disabled={busy}>
							Alle als ZIP herunterladen
						</Button>
						<Button type="button" variant="danger" size="sm" onClick={() => setConfirmingClear(true)} disabled={busy}>
							Bibliothek leeren
						</Button>
					</div>
				)}

				{confirmingClear && replays && (
					<div className="mb-3 p-3 rounded-[10px] border border-accent-red/40 bg-accent-red/5">
						<InlineConfirm
							message={`Alle ${replays.length} Replays endgültig löschen? Das lässt sich nicht rückgängig machen.`}
							confirmLabel="Alle löschen"
							onConfirm={handleClear}
							onCancel={() => setConfirmingClear(false)}
						/>
					</div>
				)}

				{libraryError ? (
					<p className="text-sm text-accent-red">
						Die Bibliothek konnte nicht gelesen werden. Möglicherweise blockiert dein Browser den lokalen
						Speicher (z. B. im privaten Modus).
					</p>
				) : replays === null ? (
					<p className="text-sm text-text-muted">Bibliothek wird geladen …</p>
				) : isEmpty ? (
					<div className="flex items-center justify-center border-2 border-dashed border-border-base bg-bg-card/50 rounded-[10px]">
						<p className="text-text-muted text-sm py-4 px-4 text-center">
							Noch keine Replays. Wähle oben eine Datei aus, um anzufangen.
						</p>
					</div>
				) : (
					<ReplayTable replays={replays} onDownload={handleDownload} onDelete={handleDelete} />
				)}
			</section>
		</PageContainer>
	);
}
