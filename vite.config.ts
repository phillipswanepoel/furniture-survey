import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: false,
			includeAssets: ['robots.txt', 'icons/icon.svg'],
			manifest: {
				name: 'Furniture Survey',
				short_name: 'Furniture',
				description: 'Local-first furniture survey app for offline project and item records.',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#fef8ec',
				theme_color: '#274c45',
				icons: [
					{
						src: 'icons/icon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				navigateFallback: '/200.html',
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']
			},
			devOptions: {
				enabled: true
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
