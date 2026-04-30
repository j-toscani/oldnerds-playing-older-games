/// <reference types="vite/client" />
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { Outlet, createRootRoute, HeadContent, Scripts, useNavigate } from '@tanstack/react-router';
import { clearGameday } from '../lib/storage';
import '../styles/globals.css';

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
			{
				title: 'Old Nerds Playing Older Games',
			},
			{
				name: 'description',
				content: 'Old Nerds Playing Older Games – Retro Gaming Community',
			},
		],
		links: [
			{
				rel: 'icon',
				type: 'image/svg+xml',
				href: '/favicon.svg',
			},
			{
				rel: 'icon',
				href: '/favicon.ico',
			},
		],
	}),
	component: RootComponent,
});

function RootComponent() {
	const navigate = useNavigate();

	const handleReset = useCallback(() => {
		clearGameday();
		navigate({ to: '/' });
	}, [navigate]);

	return (
		<RootDocument>
			<nav className="flex items-center justify-between px-6 py-3 border-b border-border-base">
				<button
					type="button"
					className="text-text-secondary hover:text-text-primary cursor-pointer bg-transparent border-none font-medium text-sm transition-colors duration-200"
					onClick={handleReset}
				>
					Reset
				</button>
			</nav>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="de">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
