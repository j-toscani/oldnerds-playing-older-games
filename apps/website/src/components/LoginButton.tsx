import { createServerFn } from "@tanstack/react-start";
import { renderServerComponent } from '@tanstack/react-start/rsc'

export function LoginButton() {
	return (
		<a
			href="/api/auth/discord"
			className="inline-flex items-center gap-2 py-2 px-4 rounded-lg text-sm font-medium text-white no-underline transition-all duration-200 hover:-translate-y-px"
			style={{ backgroundColor: '#5865F2' }}
		>
			<svg width="20" height="15" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path
					d="M60.1 4.9A58.5 58.5 0 0 0 45.4.2a.2.2 0 0 0-.2.1 40.7 40.7 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37.4 37.4 0 0 0 25.4.3a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.5 4.9a.2.2 0 0 0-.1.1C1.5 18.7-.9 32.2.3 45.5v.1a58.8 58.8 0 0 0 17.9 9.1.2.2 0 0 0 .3-.1 42.1 42.1 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.8 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.4 36.4 0 0 1-5.5 2.7.2.2 0 0 0-.1.3 47.3 47.3 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 58.6 58.6 0 0 0 18-9.1v-.1c1.4-14.8-2.3-27.7-9.8-39.1a.2.2 0 0 0-.1-.1ZM23.7 37.3c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.7 6.9-6.2 6.9Zm22.9 0c-3.4 0-6.2-3.1-6.2-6.9s2.7-6.9 6.2-6.9 6.3 3.1 6.2 6.9c0 3.8-2.8 6.9-6.2 6.9Z"
					fill="currentColor"
				/>
			</svg>
			Login mit Discord
		</a>
	);
}

export const getLoginButton = createServerFn().handler(async () => {
	const Renderable = await renderServerComponent(<LoginButton />)
	return { Renderable }
})