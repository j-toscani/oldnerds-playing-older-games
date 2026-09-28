import { useState, type ChangeEvent } from 'react';
import type { ReplayData } from '@onog/shared';
import type { FileImport } from '../lib/replay-import';
import { formatDuration, formatPlayedAt, formatTeams } from '../lib/replay-format';
import { Button } from './Button';
import { IconButton } from './IconButton';

const fileInputBase =
	'block w-full text-sm text-text-muted cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 file:mr-4 file:py-2.5 file:px-4 file:rounded-[10px] file:font-medium file:cursor-pointer file:transition-all file:duration-200';

/** Mirrors the Button variants, applied to the input's native file button */
const fileButtonVariants = {
	primary: 'file:border-0 file:bg-accent-gold file:text-white hover:file:bg-accent-gold-light',
	secondary:
		'file:border file:border-solid file:border-border-base file:bg-bg-elevated file:text-text-primary hover:file:bg-bg-hover',
};

type FilePickerProps = {
	id: string;
	label: string;
	accept: string;
	multiple?: boolean;
	disabled?: boolean;
	variant?: keyof typeof fileButtonVariants;
	onFiles: (files: File[]) => void;
};

/** Native file input, so keyboard and screen-reader support come for free */
export function FilePicker({
	id,
	label,
	accept,
	multiple,
	disabled,
	variant = 'secondary',
	onFiles,
}: FilePickerProps) {
	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files ?? []);
		// Reset so picking the same file again still fires a change event
		event.target.value = '';
		if (files.length > 0) onFiles(files);
	};

	return (
		<div>
			<label htmlFor={id} className="block text-sm text-text-secondary mb-2">
				{label}
			</label>
			<input
				id={id}
				type="file"
				accept={accept}
				multiple={multiple}
				disabled={disabled}
				onChange={handleChange}
				className={`${fileInputBase} ${fileButtonVariants[variant]}`}
			/>
		</div>
	);
}

function ImportStatus({ entry }: { entry: FileImport }) {
	switch (entry.status) {
		case 'pending':
			return <span className="text-text-muted">Wartet …</span>;
		case 'parsing':
			return <span className="text-text-secondary">Wird analysiert …</span>;
		case 'saved':
			return <span className="text-text-secondary">Gespeichert</span>;
		case 'duplicate':
			return <span className="text-text-muted">Bereits in deiner Bibliothek</span>;
		case 'error':
			return <span className="text-accent-red">{entry.message}</span>;
	}
}

export function ImportProgress({ imports }: { imports: FileImport[] }) {
	return (
		<ul className="list-none flex flex-col gap-2 mt-4" aria-live="polite">
			{imports.map((entry, index) => (
				<li
					// File names can repeat within one selection, and the list is only
					// ever replaced as a whole, never reordered, so the index is stable.
					// eslint-disable-next-line @eslint-react/no-array-index-key
					key={`${index}-${entry.fileName}`}
					className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-bg-card border border-border-base rounded-[10px] py-2.5 px-4 text-sm"
				>
					<span className="text-text-primary break-all">{entry.fileName}</span>
					<ImportStatus entry={entry} />
				</li>
			))}
		</ul>
	);
}

type InlineConfirmProps = {
	message: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
};

/** In-page confirmation for destructive actions, instead of `window.confirm` */
export function InlineConfirm({ message, confirmLabel, onConfirm, onCancel }: InlineConfirmProps) {
	return (
		<div role="alertdialog" aria-label={message} className="flex flex-wrap items-center gap-2">
			<span className="text-sm text-text-secondary">{message}</span>
			<Button type="button" variant="danger" size="sm" onClick={onConfirm}>
				{confirmLabel}
			</Button>
			{/* Focus the harmless choice, so a reflexive Enter doesn't delete anything */}
			<Button type="button" variant="ghost" size="sm" onClick={onCancel} autoFocus>
				Abbrechen
			</Button>
		</div>
	);
}

type ReplayTableProps = {
	replays: ReplayData[];
	onDownload: (replay: ReplayData) => void;
	onDelete: (id: string) => void;
};

export function ReplayTable({ replays, onDownload, onDelete }: ReplayTableProps) {
	const [confirmingId, setConfirmingId] = useState<string | null>(null);

	return (
		<div className="overflow-x-auto border border-border-base rounded-[10px] bg-bg-card">
			<table className="w-full text-sm text-left border-collapse">
				<thead className="text-text-muted text-xs uppercase tracking-wider">
					<tr className="border-b border-border-base">
						<th scope="col" className="py-2.5 px-3 font-semibold">Gespielt</th>
						<th scope="col" className="py-2.5 px-3 font-semibold">Map</th>
						<th scope="col" className="py-2.5 px-3 font-semibold">Spieler</th>
						<th scope="col" className="py-2.5 px-3 font-semibold text-right">Dauer</th>
						<th scope="col" className="py-2.5 px-3">
							<span className="sr-only">Aktionen</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{replays.map((replay) =>
						confirmingId === replay.id ? (
							<tr key={replay.id} className="border-b border-border-base last:border-b-0 bg-accent-red/5">
								<td colSpan={5} className="py-2 px-3">
									<InlineConfirm
										message={`„${replay.map}“ endgültig löschen?`}
										confirmLabel="Löschen"
										onConfirm={() => {
											setConfirmingId(null);
											onDelete(replay.id);
										}}
										onCancel={() => setConfirmingId(null)}
									/>
								</td>
							</tr>
						) : (
							<tr
								key={replay.id}
								className="border-b border-border-base last:border-b-0 hover:bg-bg-hover transition-colors duration-200"
							>
								<td className="py-2.5 px-3 whitespace-nowrap text-text-primary">
									{formatPlayedAt(replay.playedAt)}
								</td>
								<td className="py-2.5 px-3 text-text-primary">{replay.map}</td>
								<td className="py-2.5 px-3 text-text-secondary">{formatTeams(replay.players)}</td>
								<td className="py-2.5 px-3 text-text-secondary text-right tabular-nums">
									{formatDuration(replay.durationSeconds)}
								</td>
								<td className="py-1 px-2 text-right whitespace-nowrap">
									{/* A button, not <a download>: the JSON is only built when asked for */}
									<button
										type="button"
										aria-label={`Download „${replay.map}“ als JSON`}
										onClick={() => onDownload(replay)}
										className="mr-2 text-accent-blue-lighter hover:text-accent-gold-lighter transition-colors duration-200 cursor-pointer"
									>
										Download
									</button>
									<IconButton
										type="button"
										variant="danger"
										label={`„${replay.map}“ löschen`}
										onClick={() => setConfirmingId(replay.id)}
									>
										✕
									</IconButton>
								</td>
							</tr>
						),
					)}
				</tbody>
			</table>
		</div>
	);
}
