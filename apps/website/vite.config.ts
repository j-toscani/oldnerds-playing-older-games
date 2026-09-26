import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	server: {
		host: true,
		port: 3000,
		proxy: {
			'/api': {
				target: process.env.API_URL || 'http://localhost:4001',
				changeOrigin: true,
			},
		},
	},
	resolve: {
		tsconfigPaths: true,
	},
	// Pre-bundling would move the wasm-bindgen glue away from its `.wasm` file
	// and break the `new URL(..., import.meta.url)` lookup in dev.
	optimizeDeps: {
		exclude: ['@onog/replay-parser'],
	},
	plugins: [
		tailwindcss(),
		tanstackStart(),
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
