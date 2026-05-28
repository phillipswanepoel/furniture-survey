<script lang="ts">
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { DEFAULT_APP_SETTINGS } from '$lib/db';
	import { checkPasscode } from '$lib/passcode';
	import { getAppSettings } from '$lib/projectStorage';
	import type { AppSettings } from '$lib/types';
	import { onDestroy, onMount } from 'svelte';

	let { children } = $props();

	let settings = $state<AppSettings>({ ...DEFAULT_APP_SETTINGS });
	let settingsLoaded = $state(false);
	let unlocked = $state(true);
	let passcodeInput = $state('');
	let passcodeError = $state('');

	onMount(() => {
		void loadSettings();
		window.addEventListener('furniture-survey:settings-changed', loadSettings);

		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
				console.error('Service worker registration failed', error);
			});
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('furniture-survey:settings-changed', loadSettings);
		}
	});

	async function loadSettings() {
		try {
			settings = await getAppSettings();
			unlocked = !settings.passcodeEnabled || !settings.passcodeHash || isSessionUnlocked(settings);
		} catch (error) {
			console.error('Could not load app settings', error);
			settings = { ...DEFAULT_APP_SETTINGS };
			unlocked = true;
		} finally {
			settingsLoaded = true;
		}
	}

	function isSessionUnlocked(activeSettings: AppSettings) {
		if (typeof sessionStorage === 'undefined') return false;
		return sessionStorage.getItem('furniture-survey-unlocked-hash') === activeSettings.passcodeHash;
	}

	function rememberUnlockedSession(activeSettings: AppSettings) {
		if (typeof sessionStorage === 'undefined' || !activeSettings.passcodeHash) return;
		sessionStorage.setItem('furniture-survey-unlocked-hash', activeSettings.passcodeHash);
	}

	async function handleUnlock(event: SubmitEvent) {
		event.preventDefault();
		passcodeError = '';

		try {
			if (await checkPasscode(passcodeInput, settings.passcodeHash)) {
				rememberUnlockedSession(settings);
				unlocked = true;
				passcodeInput = '';
			} else {
				passcodeError = 'Passcode is not correct.';
			}
		} catch (error) {
			console.error(error);
			passcodeError = 'Could not check the passcode on this device.';
		}
	}
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
		{#if !settingsLoaded}
			<section class="card lock-card">Loading…</section>
		{:else if !unlocked}
			<section class="card lock-card" aria-labelledby="lock-heading">
				<p class="eyebrow">Locked</p>
				<h1 id="lock-heading">Enter passcode</h1>
				<p class="muted">This protects casual access on this device only.</p>

				<form class="lock-form" onsubmit={handleUnlock}>
					<label for="app-passcode">Passcode</label>
					<input
						id="app-passcode"
						type="password"
						bind:value={passcodeInput}
						autocomplete="current-password"
						inputmode="numeric"
					/>
					<button type="submit" disabled={!passcodeInput.trim()}>Unlock</button>
				</form>

				{#if passcodeError}
					<p class="error" role="alert">{passcodeError}</p>
				{/if}
			</section>
		{:else}
			{@render children()}
		{/if}
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
		color: #123b43;
		background: #fef8ec;
		font-synthesis: none;
		text-rendering: optimizeLegibility;
		-webkit-font-smoothing: antialiased;
		--color-page: #fef8ec;
		--color-surface: #fffaf2;
		--color-surface-strong: #ffffff;
		--color-text: #123b43;
		--color-muted: #60777d;
		--color-border: #e8dcc8;
		--color-primary: #274c45;
		--color-primary-strong: #173a34;
		--color-primary-soft: #dfeae6;
		--color-secondary-soft: #f4e4ee;
		--color-warm-soft: #f5e6c8;
		--color-cool-soft: #dfe9f8;
		--color-danger: #a73737;
		--color-danger-soft: #f8dddd;
		--blur-surface: none;
		--radius-card: 1.25rem;
		--shadow-card: 0 18px 50px rgb(39 76 69 / 0.12);
	}

	:global(body) {
		min-width: 320px;
		min-height: 100vh;
		margin: 0;
		background:
			radial-gradient(circle at top left, rgb(216 185 111 / 0.35), transparent 32rem),
			radial-gradient(circle at top right, rgb(244 228 238 / 0.55), transparent 30rem),
			radial-gradient(circle at 50% 100%, rgb(223 234 230 / 0.55), transparent 34rem),
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
		border-radius: var(--radius-card);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		backdrop-filter: var(--blur-surface);
	}

	:global(.back-link) {
		display: inline-flex;
		margin: 0.1rem 0 1rem;
		color: var(--color-muted);
		font-size: 0.9rem;
		font-weight: 700;
		text-decoration: none;
	}

	:global(.success),
	:global(.error) {
		border-radius: 1rem;
		padding: 0.9rem 1rem;
		font-weight: 700;
	}

	:global(.success) {
		border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
		background: var(--color-primary-soft);
		color: var(--color-primary);
	}

	:global(.error) {
		border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
		background: var(--color-danger-soft);
		color: var(--color-danger);
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

	.lock-card {
		display: grid;
		gap: 1rem;
		max-width: 28rem;
		margin: 12vh auto 0;
		padding: 1.15rem;
	}

	.lock-card h1 {
		margin: 0;
		font-size: clamp(2.2rem, 12vw, 4rem);
		line-height: 0.95;
		letter-spacing: -0.08em;
	}

	.lock-form {
		display: grid;
		gap: 0.75rem;
	}

	.lock-form label {
		font-weight: 700;
	}
</style>
