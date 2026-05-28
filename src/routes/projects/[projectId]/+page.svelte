<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getBackupReminder, type BackupReminder } from '$lib/backupReminders';
	import { countSavedProjectItems } from '$lib/itemStorage';
	import { deleteProject, getProject } from '$lib/projectStorage';
	import type { Project } from '$lib/types';
	import { createProjectZip, downloadBlob, markProjectAsExported } from '$lib/zipExport';

	let project = $state<Project | null>(null);
	let itemCount = $state(0);
	let backupReminder = $state<BackupReminder | null>(null);
	let isLoading = $state(true);
	let isDeleting = $state(false);
	let isExporting = $state(false);
	let errorMessage = $state('');
	let actionErrorMessage = $state('');
	let exportStatusMessage = $state('');

	const projectId = $derived(page.params.projectId ?? '');

	onMount(() => {
		void loadProject();
	});

	async function loadProject() {
		isLoading = true;
		errorMessage = '';
		actionErrorMessage = '';

		try {
			const existingProject = await getProject(projectId);
			project = existingProject ?? null;
			itemCount = existingProject ? await countSavedProjectItems(existingProject.id) : 0;
			backupReminder = existingProject ? getBackupReminder(existingProject, itemCount) : null;
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not load this project from local storage.';
		} finally {
			isLoading = false;
		}
	}

	async function handleDeleteProject() {
		if (!project) return;
		if (!confirm(`Delete “${project.name}” and all of its local data?`)) return;

		isDeleting = true;
		actionErrorMessage = '';

		try {
			await deleteProject(project.id);
			location.href = resolve('/');
		} catch (error) {
			console.error(error);
			actionErrorMessage = 'Could not delete project.';
			isDeleting = false;
		}
	}

	async function handleExportProject() {
		if (!project) return;

		const activeProject = project;
		isExporting = true;
		actionErrorMessage = '';
		exportStatusMessage = '';

		try {
			const zipExport = await createProjectZip(activeProject.id);
			downloadBlob(zipExport.blob, zipExport.filename);

			project = await markProjectAsExported(activeProject.id, {
				itemCount: zipExport.metadata.itemCount,
				exportedAt: zipExport.metadata.exportedAt
			});
			itemCount = zipExport.metadata.itemCount;
			backupReminder = project ? getBackupReminder(project, itemCount) : null;
			exportStatusMessage = `Exported ${zipExport.filename}.`;
		} catch (error) {
			console.error(error);
			actionErrorMessage =
				error instanceof Error ? error.message : 'Could not export this project.';
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>{project ? `${project.name} · Furniture Survey` : 'Project · Furniture Survey'}</title>
</svelte:head>

<a class="back-link" href={resolve('/')}>← Projects</a>

{#if isLoading}
	<section class="card state-card">Loading project…</section>
{:else if errorMessage}
	<section class="card state-card error" role="alert">{errorMessage}</section>
{:else if !project}
	<section class="card state-card">
		<p class="eyebrow">Not found</p>
		<h1>Project not found</h1>
		<p class="muted">It may have been deleted.</p>
		<a class="button" href={resolve('/')}>Back to projects</a>
	</section>
{:else}
	<section class="project-hero">
		<h1>{project.name}</h1>
		<p class="muted">Items added: {itemCount}</p>
	</section>

	{#if backupReminder}
		<section class="card backup-card" aria-labelledby="backup-heading">
			<div>
				<p class="eyebrow">Backup reminder</p>
				<h2 id="backup-heading">Export your latest data</h2>
				<p>{backupReminder.message}</p>
			</div>
			<button class="secondary" type="button" onclick={handleExportProject} disabled={isExporting}>
				{isExporting ? 'Exporting…' : 'Export ZIP'}
			</button>
		</section>
	{/if}

	{#if exportStatusMessage}
		<p class="success" role="status">{exportStatusMessage}</p>
	{/if}

	{#if actionErrorMessage}
		<p class="error" role="alert">{actionErrorMessage}</p>
	{/if}

	<section class="card actions-card" aria-labelledby="actions-heading">
		<h2 id="actions-heading">Actions</h2>

		<div class="actions-grid">
			<a
				class="button"
				href={resolve('/projects/[projectId]/items/new', { projectId: project.id })}
			>
				Continue survey
			</a>
			<button class="secondary" type="button" onclick={handleExportProject} disabled={isExporting}>
				{isExporting ? 'Exporting…' : 'Export'}
			</button>
			<button
				class="danger"
				type="button"
				onclick={handleDeleteProject}
				disabled={isDeleting || isExporting}
			>
				{isDeleting ? 'Deleting…' : 'Delete'}
			</button>
			<a
				class="button secondary"
				href={resolve('/projects/[projectId]/items', { projectId: project.id })}
			>
				Review items
			</a>
		</div>
	</section>
{/if}

<style>
	.project-hero {
		padding: 0.7rem 0 1.15rem;
	}

	.project-hero h1,
	.state-card h1 {
		max-width: 13ch;
		margin: 0;
		font-size: clamp(2.45rem, 14vw, 4.8rem);
		font-weight: 700;
		line-height: 0.92;
		letter-spacing: -0.09em;
	}

	.project-hero .muted {
		margin-top: 0.75rem;
	}

	.actions-grid {
		display: grid;
		gap: 0.8rem;
	}

	.actions-card,
	.backup-card,
	.state-card {
		padding: 1rem;
	}

	.actions-card {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}

	.backup-card {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
		background: var(--color-warm-soft);
	}

	.backup-card h2,
	.backup-card p {
		margin: 0;
	}

	.backup-card button {
		width: 100%;
	}

	h2,
	p {
		margin-top: 0;
	}

	h2 {
		margin-bottom: 0;
		font-size: 1.18rem;
		font-weight: 650;
	}

	.actions-grid button,
	.actions-grid .button {
		width: 100%;
	}

	@media (min-width: 700px) {
		.actions-card,
		.backup-card {
			grid-template-columns: 0.9fr 1.1fr;
			align-items: center;
		}

		.backup-card button {
			width: auto;
			justify-self: end;
		}

		.actions-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
