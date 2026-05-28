<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getBackupReminder, type BackupReminder } from '$lib/backupReminders';
	import { countSavedProjectItems } from '$lib/itemStorage';
	import { createProject, deleteProject, getProjects } from '$lib/projectStorage';
	import type { Project } from '$lib/types';

	let projects = $state<Project[]>([]);
	let projectName = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let deletingProjectId = $state<string | null>(null);
	let exportingProjectId = $state<string | null>(null);
	let errorMessage = $state('');
	let statusMessage = $state('');
	let projectMeta = $state<Record<string, { itemCount: number; reminder: BackupReminder | null }>>(
		{}
	);

	onMount(() => {
		void loadProjects();
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
	<h1>Furniture<br />surveyor</h1>
	<svg
		class="measurement-icon"
		viewBox="0 0 220 180"
		role="img"
		aria-label="Isometric box measurement placeholder"
	>
		<defs>
			<marker
				id="arrow-head"
				viewBox="0 0 10 10"
				refX="8"
				refY="5"
				markerWidth="5"
				markerHeight="5"
				orient="auto-start-reverse"
			>
				<path d="M 0 0 L 10 5 L 0 10 z" />
			</marker>
		</defs>
		<g class="box-lines">
			<path d="M70 62 L126 30 L180 62 L124 95 Z" />
			<path d="M70 62 L70 118 L124 151 L124 95" />
			<path d="M180 62 L180 118 L124 151" />
			<path d="M70 118 L124 87 L180 118" />
		</g>
		<g class="dimension-lines">
			<path d="M58 126 L113 159" marker-start="url(#arrow-head)" marker-end="url(#arrow-head)" />
			<path d="M133 158 L191 124" marker-start="url(#arrow-head)" marker-end="url(#arrow-head)" />
			<path d="M192 61 L192 119" marker-start="url(#arrow-head)" marker-end="url(#arrow-head)" />
		</g>
		<g class="axis-lines">
			<path d="M31 135 L63 153" marker-end="url(#arrow-head)" />
			<path d="M31 135 L31 100" marker-end="url(#arrow-head)" />
			<path d="M31 135 L8 149" marker-end="url(#arrow-head)" />
		</g>
		<g class="icon-labels" aria-hidden="true">
			<text x="81" y="169">W</text>
			<text x="161" y="151">L</text>
			<text x="199" y="94">H</text>
		</g>
	</svg>
</section>

<section class="projects" aria-labelledby="projects-heading">
	<div class="section-heading">
		<h2 id="projects-heading">Projects</h2>
	</div>

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

	{#if statusMessage}
		<p class="success" role="status">{statusMessage}</p>
	{/if}

	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.2rem 0 1rem;
	}

	.hero h1 {
		display: inline-block;
		margin: 0;
		padding-right: 0.08em;
		color: var(--color-primary);
		font-size: clamp(2.65rem, 16vw, 5.2rem);
		font-weight: 700;
		line-height: 0.95;
		letter-spacing: -0.075em;
	}

	.measurement-icon {
		width: clamp(7.5rem, 32vw, 13rem);
		flex: 0 0 auto;
		color: var(--color-primary);
		overflow: visible;
	}

	.measurement-icon path {
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.measurement-icon marker path {
		fill: currentColor;
		stroke: none;
	}

	.box-lines path {
		stroke-width: 5;
	}

	.dimension-lines path {
		stroke-width: 3;
	}

	.axis-lines path {
		stroke-width: 2.5;
	}

	.icon-labels {
		fill: currentColor;
		font-size: 16px;
		font-weight: 800;
		letter-spacing: 0;
	}

	.create-card,
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

	.create-card h2 {
		color: var(--color-primary);
		font-size: 1.2rem;
		letter-spacing: normal;
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
		margin: 4.2rem 0 0.9rem;
	}

	#projects-heading {
		margin-left: 0.45rem;
		color: var(--color-primary);
		font-size: clamp(1.65rem, 8vw, 2.45rem);
		letter-spacing: -0.04em;
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

	.create-card button,
	.project-actions .button {
		background: var(--color-primary);
		color: white;
	}

	.create-card button:disabled {
		opacity: 1;
	}

	.create-card button:not(:disabled):hover,
	.project-actions .button:hover {
		background: var(--color-primary-strong);
	}

	.empty {
		text-align: center;
	}

	.empty h3 {
		margin-bottom: 0.35rem;
		font-weight: 650;
	}

	@media (min-width: 700px) {
		.hero {
			gap: 2rem;
		}

		.create-card {
			grid-template-columns: 0.8fr 1.2fr;
			align-items: center;
			padding: 1.15rem;
		}

		form {
			grid-template-columns: 1fr auto;
			align-items: end;
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
