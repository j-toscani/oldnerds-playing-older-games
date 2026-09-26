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
import { createLibraryExport, exportFileName, parseLibraryExport } from '../../lib/replay-export';

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

function downloadJson(data: unknown, fileName: string) {
	const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
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

	const handleExport = () => {
		if (!replays) return;
		const now = new Date();
		downloadJson(createLibraryExport(replays, now), exportFileName(now));
	};

	const handleImportFile = async ([file]: File[]) => {
		setBusy(true);
		setNotice(null);
		try {
			const result = parseLibraryExport(await file.text());
			if (!result.ok) {
				setNotice({ tone: 'error', text: result.error });
				return;
			}

			let saved = 0;
			let duplicates = 0;
			for (const replay of result.replays) {
				const outcome = await saveReplay(replay);
				if (outcome.status === 'saved') saved++;
				else duplicates++;
			}
			if (saved > 0) void requestPersistentStorage();
			setNotice({
				tone: 'info',
				text: `${saved} ${saved === 1 ? 'Replay' : 'Replays'} importiert, ${duplicates} bereits vorhanden.`,
			});
		} catch (err) {
			console.error('Failed to import replay library', err);
			setNotice({ tone: 'error', text: 'Der Import ist fehlgeschlagen. Bereits importierte Replays bleiben erhalten.' });
		} finally {
			await reload();
			setBusy(false);
		}
	};

	const isEmpty = replays !== null && replays.length === 0;

	return (
		<PageContainer>
			<PageTitle>Replays analysieren</PageTitle>
			<PageSubtitle>Lies deine StarCraft-II-Replays aus und sammle sie in deiner Bibliothek.</PageSubtitle>
			<p className="text-sm text-text-muted mb-8">
				Die Dateien werden direkt in deinem Browser ausgelesen und verlassen dein Gerät nicht. Die Bibliothek
				liegt nur in diesem Browser: Auf anderen Geräten ist sie nicht verfügbar, und wer den Browser-Speicher
				leert, löscht sie mit. Sichern kannst du sie über den Export.
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
					<ReplayTable replays={replays} onDelete={handleDelete} />
				)}

				<div className="flex flex-wrap items-end justify-between gap-4 mt-6">
					<Button type="button" variant="outlined" size="sm" onClick={handleExport} disabled={!replays || isEmpty}>
						Exportieren
					</Button>
					{replays && replays.length > 0 && !confirmingClear && (
						<Button type="button" variant="danger" size="sm" onClick={() => setConfirmingClear(true)} disabled={busy}>
							Bibliothek leeren
						</Button>
					)}
				</div>

				{confirmingClear && replays && (
					<div className="mt-4 p-3 rounded-[10px] border border-accent-red/40 bg-accent-red/5">
						<InlineConfirm
							message={`Alle ${replays.length} Replays endgültig löschen? Das lässt sich nicht rückgängig machen.`}
							confirmLabel="Alle löschen"
							onConfirm={handleClear}
							onCancel={() => setConfirmingClear(false)}
						/>
					</div>
				)}

				<div className="mt-6">
					<FilePicker
						id="library-import"
						label="Export importieren (.json)"
						accept=".json,application/json"
						disabled={busy}
						onFiles={handleImportFile}
					/>
				</div>
			</section>
		</PageContainer>
	);
}
