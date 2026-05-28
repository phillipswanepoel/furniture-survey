<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { createProject, deleteProject, getProjects } from '$lib/projectStorage';
	import type { Project } from '$lib/types';

	let projects = $state<Project[]>([]);
	let projectName = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let deletingProjectId = $state<string | null>(null);
	let errorMessage = $state('');

	onMount(() => {
		void loadProjects();
	});

	async function loadProjects() {
		isLoading = true;
		errorMessage = '';

		try {
			projects = await getProjects();
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not load projects from this device.';
		} finally {
			isLoading = false;
		}
	}

	async function handleCreateProject(event: SubmitEvent) {
		event.preventDefault();
		isSaving = true;
		errorMessage = '';

		try {
			await createProject({ name: projectName });
			projectName = '';
			projects = await getProjects();
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

		try {
			await deleteProject(project.id);
			projects = projects.filter((existingProject) => existingProject.id !== project.id);
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not delete project.';
		} finally {
			deletingProjectId = null;
		}
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Furniture Survey</title>
	<meta
		name="description"
		content="Create local furniture survey projects that are stored on this device."
	/>
</svelte:head>

<section class="hero">
	<p class="eyebrow">Local-first survey</p>
	<h1>Survey furniture offline, project by project.</h1>
	<p class="muted">
		Create projects and add item records now. Photos, export, passcode, and reminders will build on
		this local IndexedDB foundation in later phases.
	</p>
</section>

<section class="card create-card" aria-labelledby="create-project-heading">
	<div>
		<p class="eyebrow">New project</p>
		<h2 id="create-project-heading">Start a survey</h2>
	</div>

	<form onsubmit={handleCreateProject}>
		<label for="project-name">Project name</label>
		<input
			id="project-name"
			bind:value={projectName}
			autocomplete="off"
			placeholder="e.g. 24 High Street"
			disabled={isSaving}
		/>
		<button type="submit" disabled={isSaving || !projectName.trim()}>
			{isSaving ? 'Creating…' : 'Create project'}
		</button>
	</form>
</section>

{#if errorMessage}
	<p class="error" role="alert">{errorMessage}</p>
{/if}

<section class="projects" aria-labelledby="projects-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Local projects</p>
			<h2 id="projects-heading">Projects on this device</h2>
		</div>
		<button class="secondary refresh" type="button" onclick={loadProjects} disabled={isLoading}>
			Refresh
		</button>
	</div>

	{#if isLoading}
		<div class="empty card">Loading projects…</div>
	{:else if projects.length === 0}
		<div class="empty card">
			<h3>No projects yet</h3>
			<p class="muted">Create your first project to verify local storage is ready.</p>
		</div>
	{:else}
		<ul aria-label="Project list">
			{#each projects as project (project.id)}
				<li class="project-card card">
					<div>
						<h3>{project.name}</h3>
						<p class="muted">Updated {formatDate(project.updatedAt)}</p>
						<dl>
							<div>
								<dt>Next item</dt>
								<dd>{project.nextItemSequence}</dd>
							</div>
							<div>
								<dt>Last room</dt>
								<dd>{project.lastRoom ?? 'None'}</dd>
							</div>
						</dl>
					</div>

					<div class="project-actions">
						<a class="button" href={resolve('/projects/[projectId]', { projectId: project.id })}
							>Open</a
						>
						<button
							class="danger"
							type="button"
							onclick={() => handleDeleteProject(project)}
							disabled={deletingProjectId === project.id}
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
		padding: 1.25rem 0 1rem;
	}

	.hero h1 {
		max-width: 11ch;
		margin: 0;
		font-size: clamp(2.35rem, 15vw, 4.8rem);
		line-height: 0.9;
		letter-spacing: -0.08em;
	}

	.hero .muted {
		max-width: 38rem;
		margin: 1rem 0 0;
		font-size: 1.05rem;
		line-height: 1.55;
	}

	.create-card,
	.empty,
	.project-card {
		padding: 1rem;
	}

	.create-card {
		display: grid;
		gap: 1rem;
		margin: 1.5rem 0;
	}

	h2,
	h3,
	p {
		margin-top: 0;
	}

	h2 {
		margin-bottom: 0;
		font-size: 1.25rem;
	}

	form {
		display: grid;
		gap: 0.75rem;
	}

	label {
		font-weight: 700;
	}

	.error {
		border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
		border-radius: 1rem;
		padding: 0.9rem 1rem;
		background: var(--color-danger-soft);
		color: var(--color-danger);
		font-weight: 700;
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin: 2rem 0 1rem;
	}

	.refresh {
		min-height: 40px;
		padding-inline: 0.85rem;
	}

	ul {
		display: grid;
		gap: 0.9rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.project-card {
		display: grid;
		gap: 1rem;
	}

	.project-card h3 {
		margin-bottom: 0.35rem;
		font-size: 1.25rem;
	}

	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 1rem 0 0;
	}

	dl div {
		min-width: 7rem;
		border-radius: 0.9rem;
		padding: 0.7rem 0.8rem;
		background: var(--color-primary-soft);
	}

	dt {
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	dd {
		margin: 0.2rem 0 0;
		font-weight: 800;
	}

	.project-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.7rem;
	}

	.empty {
		text-align: center;
	}

	.empty h3 {
		margin-bottom: 0.4rem;
	}

	@media (min-width: 700px) {
		.create-card {
			grid-template-columns: 0.8fr 1.2fr;
			align-items: end;
			padding: 1.25rem;
		}

		form {
			grid-template-columns: 1fr auto;
			align-items: end;
		}

		label {
			grid-column: 1 / -1;
		}

		.project-card {
			grid-template-columns: 1fr auto;
			align-items: center;
		}

		.project-actions {
			grid-template-columns: auto auto;
		}
	}
</style>
