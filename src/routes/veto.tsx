import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/veto')({
	component: Veto,
});

function Veto() {
	return (
		<div id="container">
			<main>
				<section id="hero">
					<h1>Veto</h1>
					<p className="tagline">Retro Gaming. Nostalgie. Gemeinschaft.</p>
					<div id="links">
						<a className="button" href="https://github.com/j-toscani/oldnerds-playing-older-games">
							GitHub
						</a>
					</div>
				</section>
			</main>
		</div>
	);
}
