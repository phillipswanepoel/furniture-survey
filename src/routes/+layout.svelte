<script lang="ts">
	import '@fontsource/monaspace-argon/latin-400.css';
	import '@fontsource/monaspace-argon/latin-500.css';
	import '@fontsource/monaspace-argon/latin-600.css';
	import '@fontsource/monaspace-argon/latin-700.css';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { DEFAULT_APP_SETTINGS } from '$lib/db';
	import { checkPasscode } from '$lib/passcode';
	import { getAppSettings } from '$lib/projectStorage';
	import { applyThemePreference } from '$lib/theme';
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
			applyThemePreference(settings.theme);
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
			<strong>Survey</strong>
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
			'Monaspace Argon', ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
		color: #183b46;
		background: #f5f2ea;
		font-synthesis: none;
		text-rendering: optimizeLegibility;
		-webkit-font-smoothing: antialiased;
		--color-page: #f5f2ea;
		--color-surface: rgb(255 252 246 / 0.74);
		--color-surface-strong: rgb(255 254 250 / 0.92);
		--color-text: #183b46;
		--color-muted: #6d7f83;
		--color-border: rgb(95 125 128 / 0.16);
		--color-primary: #2f6472;
		--color-primary-strong: #183b46;
		--color-primary-soft: #dceff0;
		--color-secondary-soft: #f1e0ec;
		--color-warm-soft: #f7e7cf;
		--color-cool-soft: #dfe9fb;
		--color-danger: #a34f5c;
		--color-danger-soft: #f7dfe2;
		--blur-surface: blur(22px) saturate(1.15);
		--radius-card: 1.55rem;
		--shadow-card: 0 24px 70px rgb(61 84 95 / 0.11);
	}

	:global(:root[data-theme='dark']) {
		color: #f2f6f4;
		background: #132329;
		--color-page: #132329;
		--color-surface: rgb(27 46 54 / 0.78);
		--color-surface-strong: rgb(31 53 61 / 0.94);
		--color-text: #f2f6f4;
		--color-muted: #a9bdc0;
		--color-border: rgb(196 220 221 / 0.16);
		--color-primary: #9fd0d8;
		--color-primary-strong: #d7f0f2;
		--color-primary-soft: #264952;
		--color-secondary-soft: #4a3045;
		--color-warm-soft: #59452d;
		--color-cool-soft: #263a55;
		--color-danger: #f0a8b2;
		--color-danger-soft: #54313a;
		--shadow-card: 0 24px 70px rgb(0 0 0 / 0.24);
	}

	@media (prefers-color-scheme: dark) {
		:global(:root[data-theme='system']) {
			color: #f2f6f4;
			background: #132329;
			--color-page: #132329;
			--color-surface: rgb(27 46 54 / 0.78);
			--color-surface-strong: rgb(31 53 61 / 0.94);
			--color-text: #f2f6f4;
			--color-muted: #a9bdc0;
			--color-border: rgb(196 220 221 / 0.16);
			--color-primary: #9fd0d8;
			--color-primary-strong: #d7f0f2;
			--color-primary-soft: #264952;
			--color-secondary-soft: #4a3045;
			--color-warm-soft: #59452d;
			--color-cool-soft: #263a55;
			--color-danger: #f0a8b2;
			--color-danger-soft: #54313a;
			--shadow-card: 0 24px 70px rgb(0 0 0 / 0.24);
		}
	}

	:global(body) {
		min-width: 320px;
		min-height: 100vh;
		margin: 0;
		background:
			radial-gradient(circle at 8% 0%, rgb(199 224 225 / 0.95), transparent 25rem),
			radial-gradient(circle at 95% 12%, rgb(248 218 229 / 0.85), transparent 26rem),
			radial-gradient(circle at 45% 105%, rgb(246 224 188 / 0.72), transparent 30rem),
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
		min-height: 46px;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
		border-radius: 999px;
		padding: 0.8rem 1.05rem;
		background: linear-gradient(135deg, #4f8b98, var(--color-primary));
		box-shadow: 0 12px 26px rgb(47 100 114 / 0.2);
		color: #fffdf8;
		font-weight: 650;
		line-height: 1;
		text-decoration: none;
		cursor: pointer;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease,
			background 160ms ease;
	}

	:global(button:hover),
	:global(.button:hover) {
		background: linear-gradient(135deg, #5d9ca8, var(--color-primary-strong));
		box-shadow: 0 16px 34px rgb(47 100 114 / 0.24);
		transform: translateY(-1px);
	}

	:global(button:disabled),
	:global(.button[aria-disabled='true']) {
		cursor: not-allowed;
		opacity: 0.52;
		transform: none;
	}

	:global(.button.secondary),
	:global(button.secondary) {
		background: rgb(255 254 250 / 0.62);
		box-shadow: none;
		color: var(--color-primary);
	}

	:global(.button.secondary:hover),
	:global(button.secondary:hover) {
		background: var(--color-primary-soft);
	}

	:global(.button.danger),
	:global(button.danger) {
		background: var(--color-danger-soft);
		box-shadow: none;
		color: var(--color-danger);
	}

	:global(input),
	:global(select),
	:global(textarea) {
		width: 100%;
		min-height: 50px;
		border: 1px solid var(--color-border);
		border-radius: 1.15rem;
		padding: 0.85rem 1rem;
		background: rgb(255 254 250 / 0.7);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.7);
		color: var(--color-text);
	}

	:global(textarea) {
		resize: vertical;
	}

	:global(input::placeholder),
	:global(textarea::placeholder) {
		color: color-mix(in srgb, var(--color-muted) 72%, white);
	}

	:global(input:focus),
	:global(select:focus),
	:global(textarea:focus) {
		border-color: color-mix(in srgb, var(--color-primary) 55%, white);
		outline: 4px solid rgb(143 189 196 / 0.24);
	}

	:global(.eyebrow) {
		margin: 0 0 0.45rem;
		color: var(--color-primary);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.1em;
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
		font-weight: 650;
		text-decoration: none;
	}

	:global(.success),
	:global(.error) {
		border-radius: 1.15rem;
		padding: 0.85rem 1rem;
		font-weight: 650;
		backdrop-filter: var(--blur-surface);
	}

	:global(.success) {
		border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
		background: rgb(220 239 240 / 0.74);
		color: var(--color-primary);
	}

	:global(.error) {
		border: 1px solid color-mix(in srgb, var(--color-danger) 24%, transparent);
		background: rgb(247 223 226 / 0.78);
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
		margin: 0 -1rem 0.8rem;
		padding: 0.85rem 1rem;
		background: linear-gradient(180deg, rgb(245 242 234 / 0.82), rgb(245 242 234 / 0.48));
		backdrop-filter: blur(24px) saturate(1.18);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 0.38rem 0.8rem 0.38rem 0.42rem;
		background: rgb(255 254 250 / 0.58);
		box-shadow: 0 12px 36px rgb(72 94 104 / 0.08);
		text-decoration: none;
		backdrop-filter: var(--blur-surface);
	}

	.brand-mark {
		display: grid;
		width: 2.2rem;
		height: 2.2rem;
		place-items: center;
		border-radius: 999px;
		background: linear-gradient(135deg, #cfe6e8, #f5dce8 55%, #f5e2bd);
		color: var(--color-primary-strong);
		font-size: 0.78rem;
		font-weight: 750;
		letter-spacing: -0.03em;
	}

	.brand strong {
		display: block;
		font-size: 0.9rem;
		font-weight: 650;
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
		font-weight: 650;
	}
</style>
