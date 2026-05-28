<script lang="ts">
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

		void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
			console.error('Service worker registration failed', error);
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-frame">
	<header class="site-header">
		<a class="brand" href={resolve('/')} aria-label="Furniture Survey home">
			<span class="brand-mark">FS</span>
			<span>
				<strong>Furniture Survey</strong>
				<small>Local-first PWA</small>
			</span>
		</a>
	</header>

	<main>
		{@render children()}
	</main>
</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(:root) {
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		color: #1d2522;
		background: #f7f3eb;
		font-synthesis: none;
		text-rendering: optimizeLegibility;
		-webkit-font-smoothing: antialiased;
		--color-page: #f7f3eb;
		--color-surface: #fffaf2;
		--color-surface-strong: #ffffff;
		--color-text: #1d2522;
		--color-muted: #68746f;
		--color-border: #ded6c8;
		--color-primary: #274c45;
		--color-primary-strong: #173a34;
		--color-primary-soft: #dfeae6;
		--color-danger: #a73737;
		--color-danger-soft: #f8dddd;
		--shadow-card: 0 18px 50px rgb(39 76 69 / 0.12);
	}

	:global(body) {
		min-width: 320px;
		min-height: 100vh;
		margin: 0;
		background:
			radial-gradient(circle at top left, rgb(216 185 111 / 0.35), transparent 32rem),
			var(--color-page);
		color: var(--color-text);
	}

	:global(a) {
		color: inherit;
	}

	:global(button),
	:global(input),
	:global(select),
	:global(textarea) {
		font: inherit;
	}

	:global(button),
	:global(.button) {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 0;
		border-radius: 999px;
		padding: 0.75rem 1rem;
		background: var(--color-primary);
		color: white;
		font-weight: 700;
		line-height: 1;
		text-decoration: none;
		cursor: pointer;
	}

	:global(button:hover),
	:global(.button:hover) {
		background: var(--color-primary-strong);
	}

	:global(button:disabled),
	:global(.button[aria-disabled='true']) {
		cursor: not-allowed;
		opacity: 0.55;
	}

	:global(.button.secondary),
	:global(button.secondary) {
		background: var(--color-primary-soft);
		color: var(--color-primary);
	}

	:global(.button.danger),
	:global(button.danger) {
		background: var(--color-danger-soft);
		color: var(--color-danger);
	}

	:global(input),
	:global(select),
	:global(textarea) {
		width: 100%;
		min-height: 48px;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		padding: 0.8rem 0.95rem;
		background: var(--color-surface-strong);
		color: var(--color-text);
	}

	:global(textarea) {
		resize: vertical;
	}

	:global(input:focus),
	:global(select:focus),
	:global(textarea:focus) {
		outline: 3px solid rgb(39 76 69 / 0.2);
		border-color: var(--color-primary);
	}

	:global(.eyebrow) {
		margin: 0 0 0.4rem;
		color: var(--color-primary);
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	:global(.muted) {
		color: var(--color-muted);
	}

	:global(.card) {
		border: 1px solid var(--color-border);
		border-radius: 1.25rem;
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}

	.app-frame {
		width: min(100%, 58rem);
		margin: 0 auto;
		padding: env(safe-area-inset-top) 1rem 2rem;
	}

	.site-header {
		position: sticky;
		top: 0;
		z-index: 10;
		margin: 0 -1rem 1rem;
		padding: 0.9rem 1rem;
		background: color-mix(in srgb, var(--color-page) 86%, transparent);
		backdrop-filter: blur(18px);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		text-decoration: none;
	}

	.brand-mark {
		display: grid;
		width: 2.55rem;
		height: 2.55rem;
		place-items: center;
		border-radius: 0.85rem;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.95rem;
		font-weight: 900;
		letter-spacing: 0.04em;
	}

	.brand strong,
	.brand small {
		display: block;
	}

	.brand strong {
		font-size: 0.98rem;
	}

	.brand small {
		margin-top: 0.1rem;
		color: var(--color-muted);
		font-size: 0.75rem;
	}

	main {
		padding-bottom: env(safe-area-inset-bottom);
	}

	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--color-page: #111815;
			--color-surface: #19211e;
			--color-surface-strong: #202a26;
			--color-text: #eef4ef;
			--color-muted: #a8b4ae;
			--color-border: #35413d;
			--color-primary: #8fc7b8;
			--color-primary-strong: #a9d8cc;
			--color-primary-soft: #243a35;
			--color-danger: #ffb4ab;
			--color-danger-soft: #402222;
			--shadow-card: 0 18px 50px rgb(0 0 0 / 0.28);
		}

		:global(body) {
			background:
				radial-gradient(circle at top left, rgb(143 199 184 / 0.18), transparent 30rem),
				var(--color-page);
		}

		:global(button),
		:global(.button) {
			color: #10211d;
		}
	}
</style>
