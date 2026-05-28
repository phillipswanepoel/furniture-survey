<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getBackupReminder, type BackupReminder } from '$lib/backupReminders';
	import { DEFAULT_APP_SETTINGS } from '$lib/db';
	import { countSavedProjectItems } from '$lib/itemStorage';
	import { createPasscodeHash, validatePasscode } from '$lib/passcode';
	import {
		createProject,
		deleteProject,
		getAppSettings,
		getProjects,
		saveAppSettings
	} from '$lib/projectStorage';
	import type { AppSettings, Project } from '$lib/types';

	let projects = $state<Project[]>([]);
	let projectName = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let deletingProjectId = $state<string | null>(null);
	let exportingProjectId = $state<string | null>(null);
	let errorMessage = $state('');
	let statusMessage = $state('');
	let settingsStatusMessage = $state('');
	let settingsErrorMessage = $state('');
	let appSettings = $state<AppSettings>({ ...DEFAULT_APP_SETTINGS });
	let newPasscode = $state('');
	let isSavingSettings = $state(false);
	let projectMeta = $state<Record<string, { itemCount: number; reminder: BackupReminder | null }>>(
		{}
	);

	onMount(() => {
		void loadProjects();
		void loadSettings();
	});

	async function loadProjects() {
		isLoading = true;
		errorMessage = '';
		statusMessage = '';

		try {
			projects = await getProjects();
			await loadProjectMeta(projects);
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not load projects from this device.';
		} finally {
			isLoading = false;
		}
	}

	async function loadProjectMeta(activeProjects: Project[]) {
		const entries = await Promise.all(
			activeProjects.map(async (project) => {
				const itemCount = await countSavedProjectItems(project.id);
				return [
					project.id,
					{ itemCount, reminder: getBackupReminder(project, itemCount) }
				] as const;
			})
		);

		projectMeta = Object.fromEntries(entries);
	}

	async function loadSettings() {
		settingsErrorMessage = '';

		try {
			appSettings = await getAppSettings();
		} catch (error) {
			console.error(error);
			settingsErrorMessage = 'Could not load settings.';
		}
	}

	function notifySettingsChanged() {
		window.dispatchEvent(new CustomEvent('furniture-survey:settings-changed'));
	}

	async function handleSetPasscode(event: SubmitEvent) {
		event.preventDefault();
		const validationError = validatePasscode(newPasscode);

		if (validationError) {
			settingsErrorMessage = validationError;
			return;
		}

		try {
			const passcodeHash = await createPasscodeHash(newPasscode);
			const saved = await saveSettings(
				{ ...appSettings, passcodeEnabled: true, passcodeHash },
				'Passcode enabled.'
			);

			if (!saved) return;

			newPasscode = '';

			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.setItem('furniture-survey-unlocked-hash', passcodeHash);
			}
		} catch (error) {
			console.error(error);
			settingsErrorMessage = error instanceof Error ? error.message : 'Could not save passcode.';
		}
	}

	async function handleDisablePasscode() {
		if (!confirm('Disable the app passcode on this device?')) return;
		const saved = await saveSettings(
			{ ...appSettings, passcodeEnabled: false, passcodeHash: null },
			'Passcode disabled.'
		);
		if (saved && typeof sessionStorage !== 'undefined') {
			sessionStorage.removeItem('furniture-survey-unlocked-hash');
		}
	}

	async function saveSettings(nextSettings: AppSettings, message: string) {
		isSavingSettings = true;
		settingsErrorMessage = '';
		settingsStatusMessage = '';

		try {
			appSettings = await saveAppSettings(nextSettings);
			settingsStatusMessage = message;
			notifySettingsChanged();
			return true;
		} catch (error) {
			console.error(error);
			settingsErrorMessage = 'Could not save settings.';
			return false;
		} finally {
			isSavingSettings = false;
		}
	}

	async function handleCreateProject(event: SubmitEvent) {
		event.preventDefault();
		isSaving = true;
		errorMessage = '';
		statusMessage = '';

		try {
			await createProject({ name: projectName });
			projectName = '';
			projects = await getProjects();
			await loadProjectMeta(projects);
		} catch (error) {
			console.error(error);
			errorMessage = error instanceof Error ? error.message : 'Could not create project.';
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteProject(project: Project) {
		if (!confirm(`Delete “${project.name}” and all of its local data?`)) return;

		deletingProjectId = project.id;
		errorMessage = '';
		statusMessage = '';

		try {
			await deleteProject(project.id);
			projects = projects.filter((existingProject) => existingProject.id !== project.id);
			await loadProjectMeta(projects);
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not delete project.';
		} finally {
			deletingProjectId = null;
		}
	}

	async function handleExportProject(project: Project) {
		exportingProjectId = project.id;
		errorMessage = '';
		statusMessage = '';

		try {
			const { createProjectZip, downloadBlob, markProjectAsExported } =
				await import('$lib/zipExport');
			const zipExport = await createProjectZip(project.id);

			downloadBlob(zipExport.blob, zipExport.filename);

			const updatedProject = await markProjectAsExported(project.id, {
				itemCount: zipExport.metadata.itemCount,
				exportedAt: zipExport.metadata.exportedAt
			});
			projects = projects.map((existingProject) =>
				existingProject.id === project.id ? updatedProject : existingProject
			);
			await loadProjectMeta(projects);
			statusMessage = `Exported ${zipExport.filename}.`;
		} catch (error) {
			console.error(error);
			errorMessage = error instanceof Error ? error.message : 'Could not export project.';
		} finally {
			exportingProjectId = null;
		}
	}
</script>

<svelte:head>
	<title>Furniture surveyor</title>
	<meta name="description" content="Create furniture survey projects on this device." />
</svelte:head>

<section class="hero">
	<h1>Furniture surveyor</h1>
</section>

<section class="card create-card" aria-labelledby="create-project-heading">
	<h2 id="create-project-heading">New project</h2>

	<form onsubmit={handleCreateProject}>
		<input
			id="project-name"
			bind:value={projectName}
			autocomplete="off"
			placeholder="e.g. 24 High Street"
			aria-label="Name"
			disabled={isSaving}
		/>
		<button type="submit" disabled={isSaving || !projectName.trim()}>
			{isSaving ? 'Creating…' : 'Create'}
		</button>
	</form>
</section>

<section class="card settings-card" aria-labelledby="settings-heading">
	<div>
		<h2 id="settings-heading">Settings</h2>
		<p class="muted">Simple on-device passcode.</p>
	</div>

	<div class="settings-grid">
		<form class="passcode-form" onsubmit={handleSetPasscode}>
			<label for="new-passcode"
				>{appSettings.passcodeEnabled ? 'Change passcode' : 'Set passcode'}</label
			>
			<div class="passcode-row">
				<input
					id="new-passcode"
					type="password"
					bind:value={newPasscode}
					autocomplete="new-password"
					placeholder="At least 4 characters"
					disabled={isSavingSettings}
				/>
				<button type="submit" disabled={isSavingSettings || !newPasscode.trim()}>
					{appSettings.passcodeEnabled ? 'Change' : 'Enable'}
				</button>
			</div>
		</form>

		{#if appSettings.passcodeEnabled}
			<button
				class="danger disable-passcode"
				type="button"
				onclick={handleDisablePasscode}
				disabled={isSavingSettings}
			>
				Disable passcode
			</button>
		{/if}
	</div>
</section>

{#if settingsStatusMessage}
	<p class="success" role="status">{settingsStatusMessage}</p>
{/if}

{#if settingsErrorMessage}
	<p class="error" role="alert">{settingsErrorMessage}</p>
{/if}

{#if statusMessage}
	<p class="success" role="status">{statusMessage}</p>
{/if}

{#if errorMessage}
	<p class="error" role="alert">{errorMessage}</p>
{/if}

<section class="projects" aria-labelledby="projects-heading">
	<div class="section-heading">
		<h2 id="projects-heading">All Projects</h2>
		<button class="secondary refresh" type="button" onclick={loadProjects} disabled={isLoading}>
			Refresh
		</button>
	</div>

	{#if isLoading}
		<div class="empty card">Loading projects…</div>
	{:else if projects.length === 0}
		<div class="empty card">
			<h3>No projects yet</h3>
			<p class="muted">Create one to start.</p>
		</div>
	{:else}
		<ul aria-label="Project list">
			{#each projects as project (project.id)}
				<li class="project-card card">
					<div class="project-summary">
						<h3>{project.name}</h3>
						<p class="muted">{projectMeta[project.id]?.itemCount ?? 0} saved items</p>
						{#if projectMeta[project.id]?.reminder}
							<p class="backup-reminder" role="status">
								{projectMeta[project.id]?.reminder?.message}
							</p>
						{/if}
					</div>

					<div class="project-actions">
						<a class="button" href={resolve('/projects/[projectId]', { projectId: project.id })}
							>Open</a
						>
						<button
							class="secondary"
							type="button"
							onclick={() => handleExportProject(project)}
							disabled={exportingProjectId === project.id || deletingProjectId === project.id}
						>
							{exportingProjectId === project.id ? 'Exporting…' : 'Export'}
						</button>
						<button
							class="danger"
							type="button"
							onclick={() => handleDeleteProject(project)}
							disabled={deletingProjectId === project.id || exportingProjectId === project.id}
						>
							{deletingProjectId === project.id ? 'Deleting…' : 'Delete'}
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.hero {
		padding: 1.2rem 0 1rem;
	}

	.hero h1 {
		max-width: 10ch;
		margin: 0;
		font-size: clamp(2.65rem, 16vw, 5.2rem);
		font-weight: 700;
		line-height: 0.9;
		letter-spacing: -0.095em;
	}

	.create-card,
	.settings-card,
	.empty,
	.project-card {
		padding: 1rem;
	}

	.create-card {
		display: grid;
		align-items: center;
		gap: 1rem;
		margin: 1.35rem 0 0.9rem;
		background: var(--color-surface);
	}

	.settings-card {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.settings-card p {
		margin-bottom: 0;
	}

	.settings-grid,
	.passcode-form {
		display: grid;
		gap: 0.7rem;
	}

	.passcode-form label {
		font-size: 0.9rem;
		font-weight: 650;
	}

	.passcode-row {
		display: grid;
		gap: 0.65rem;
	}

	.disable-passcode {
		width: 100%;
	}

	h2,
	h3,
	p {
		margin-top: 0;
	}

	h2 {
		margin-bottom: 0;
		font-size: 1.2rem;
		font-weight: 650;
	}

	form {
		display: grid;
		gap: 0.75rem;
	}

	form button {
		min-height: 50px;
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin: 1.8rem 0 0.9rem;
	}

	.refresh {
		min-height: 40px;
		padding-inline: 0.85rem;
	}

	ul {
		display: grid;
		gap: 0.85rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.project-card {
		display: grid;
		gap: 1rem;
	}

	.project-card h3 {
		margin-bottom: 0.25rem;
		font-size: 1.18rem;
		font-weight: 650;
	}

	.project-summary {
		display: grid;
		gap: 0.35rem;
	}

	.project-summary p {
		margin-bottom: 0;
	}

	.backup-reminder {
		border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
		border-radius: 1rem;
		padding: 0.7rem;
		background: var(--color-warm-soft);
		color: var(--color-primary-strong);
		font-size: 0.82rem;
		font-weight: 650;
	}

	.project-actions {
		display: grid;
		gap: 0.65rem;
	}

	.project-actions .button,
	.project-actions button {
		width: 100%;
	}

	.empty {
		text-align: center;
	}

	.empty h3 {
		margin-bottom: 0.35rem;
		font-weight: 650;
	}

	@media (min-width: 700px) {
		.create-card {
			grid-template-columns: 0.8fr 1.2fr;
			align-items: center;
			padding: 1.15rem;
		}

		form {
			grid-template-columns: 1fr auto;
			align-items: end;
		}

		.settings-card {
			grid-template-columns: 0.8fr 1.2fr;
		}

		.passcode-row {
			grid-template-columns: 1fr auto;
		}

		.project-card {
			grid-template-columns: 1fr auto;
			align-items: center;
		}

		.project-actions {
			grid-template-columns: repeat(3, 6.2rem);
		}
	}
</style>
