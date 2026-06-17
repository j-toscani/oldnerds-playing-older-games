import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import rsc from '@vitejs/plugin-rsc'
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	server: {
		port: 3000,
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		tailwindcss(),
		tanstackStart({
			rsc: {
				enabled: true,
			},
		}),
		rsc(),
		nitro({
			preset: 'bun',
			serverDir: './server',
			output: {
				dir: 'dist',
				serverDir: 'dist/server',
				publicDir: 'dist/public',
			},
		}),
		viteReact(),
	],
});
