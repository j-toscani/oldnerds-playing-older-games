import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/veto')({
	component: Veto,
});

function Veto() {
	return (
		<div className="h-full flex items-center justify-center">
			<main className="h-full flex justify-center">
				<section className="flex items-start flex-col justify-center p-8">
					<h1 className="text-4xl font-bold mb-2 bg-linear-to-br from-accent-purple-light via-accent-pink-light to-accent-orange bg-clip-text text-transparent">
						Veto
					</h1>
					<p className="text-xl text-text-secondary mb-8 tracking-[-0.01em]">
						Retro Gaming. Nostalgie. Gemeinschaft.
					</p>
					<div className="flex gap-4">
						<a
							className="flex items-center py-3 px-5 text-white no-underline rounded-[10px] font-medium transition-all duration-200 bg-linear-to-br from-accent-purple to-accent-pink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.24),0_4px_16px_rgba(124,58,237,0.3)] hover:-translate-y-px hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_8px_24px_rgba(124,58,237,0.4)]"
							href="https://github.com/j-toscani/oldnerds-playing-older-games"
						>
							GitHub
						</a>
					</div>
				</section>
			</main>
		</div>
	);
}
