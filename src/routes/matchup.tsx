import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/matchup')({
	component: Matchup,
});

function Matchup() {
	return (
		<div id="container">
			<main>
				<section id="hero">
					<h1>Matchup</h1>
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
