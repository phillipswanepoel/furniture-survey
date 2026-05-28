<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { countSavedProjectItems, getDraftItem } from '$lib/itemStorage';
	import { deleteProject, getProject } from '$lib/projectStorage';
	import type { Item, Project } from '$lib/types';

	let project = $state<Project | null>(null);
	let draftItem = $state<Item | null>(null);
	let itemCount = $state(0);
	let isLoading = $state(true);
	let isDeleting = $state(false);
	let errorMessage = $state('');

	const projectId = $derived(page.params.projectId ?? '');

	onMount(() => {
		void loadProject();
	});

	async function loadProject() {
		isLoading = true;
		errorMessage = '';

		try {
			const existingProject = await getProject(projectId);
			project = existingProject ?? null;
			itemCount = existingProject ? await countSavedProjectItems(existingProject.id) : 0;
			draftItem = existingProject ? await getDraftItem(existingProject.id) : null;
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
		errorMessage = '';

		try {
			await deleteProject(project.id);
			location.href = resolve('/');
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not delete project.';
			isDeleting = false;
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
		<p class="muted">This project may have been deleted from this device.</p>
		<a class="button" href={resolve('/')}>Back to projects</a>
	</section>
{:else}
	<section class="project-hero">
		<p class="eyebrow">Project</p>
		<h1>{project.name}</h1>
		<p class="muted">
			Created {formatDate(project.createdAt)} · Updated {formatDate(project.updatedAt)}
		</p>
	</section>

	<section class="stats" aria-label="Project summary">
		<div class="card stat-card">
			<span>{itemCount}</span>
			<strong>Items saved</strong>
			<small>{draftItem ? 'Draft in progress.' : 'Ready for review.'}</small>
		</div>
		<div class="card stat-card">
			<span>{project.nextItemSequence}</span>
			<strong>Next sequence</strong>
			<small>Global per project.</small>
		</div>
		<div class="card stat-card">
			<span>{project.lastDimensionUnit}</span>
			<strong>Default unit</strong>
			<small>Carried into new drafts.</small>
		</div>
	</section>

	<section class="card actions-card" aria-labelledby="actions-heading">
		<div>
			<p class="eyebrow">Workflow</p>
			<h2 id="actions-heading">Project actions</h2>
			<p class="muted">Add items and photos now. ZIP export arrives in phase 4.</p>
		</div>

		<div class="actions-grid">
			<a
				class="button"
				href={resolve('/projects/[projectId]/items/new', { projectId: project.id })}
			>
				{draftItem ? 'Continue draft' : 'Add item'}
			</a>
			<a
				class="button secondary"
				href={resolve('/projects/[projectId]/items', { projectId: project.id })}
			>
				Review items
			</a>
			<button class="secondary" type="button" disabled>Export ZIP · Phase 4</button>
			<button class="danger" type="button" onclick={handleDeleteProject} disabled={isDeleting}>
				{isDeleting ? 'Deleting…' : 'Delete project'}
			</button>
		</div>
	</section>

	<section class="card data-card" aria-labelledby="storage-heading">
		<p class="eyebrow">IndexedDB record</p>
		<h2 id="storage-heading">Project storage state</h2>
		<dl>
			<div>
				<dt>Project ID</dt>
				<dd>{project.id}</dd>
			</div>
			<div>
				<dt>Last room</dt>
				<dd>{project.lastRoom ?? 'None yet'}</dd>
			</div>
			<div>
				<dt>Last exported</dt>
				<dd>{project.lastExportedAt ? formatDate(project.lastExportedAt) : 'Never'}</dd>
			</div>
			<div>
				<dt>Items at last export</dt>
				<dd>{project.itemCountAtLastExport}</dd>
			</div>
		</dl>
	</section>
{/if}

<style>
	.back-link {
		display: inline-flex;
		margin: 0.25rem 0 1rem;
		color: var(--color-muted);
		font-weight: 800;
		text-decoration: none;
	}

	.project-hero {
		padding: 0.75rem 0 1.25rem;
	}

	.project-hero h1,
	.state-card h1 {
		max-width: 13ch;
		margin: 0;
		font-size: clamp(2.4rem, 14vw, 4.5rem);
		line-height: 0.95;
		letter-spacing: -0.07em;
	}

	.project-hero .muted {
		margin-top: 0.8rem;
	}

	.stats,
	.actions-grid {
		display: grid;
		gap: 0.85rem;
	}

	.stats {
		grid-template-columns: 1fr;
		margin-bottom: 1rem;
	}

	.stat-card,
	.actions-card,
	.data-card,
	.state-card {
		padding: 1rem;
	}

	.stat-card {
		display: grid;
		gap: 0.2rem;
	}

	.stat-card span {
		font-size: 2rem;
		font-weight: 900;
		letter-spacing: -0.05em;
	}

	.stat-card strong {
		font-size: 0.95rem;
	}

	.stat-card small {
		color: var(--color-muted);
	}

	.actions-card,
	.data-card {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}

	h2,
	p {
		margin-top: 0;
	}

	h2 {
		margin-bottom: 0.4rem;
	}

	.actions-grid button,
	.actions-grid .button {
		width: 100%;
	}

	.data-card dl {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}

	.data-card dl div {
		min-width: 0;
		border-radius: 0.9rem;
		padding: 0.75rem;
		background: var(--color-primary-soft);
	}

	dt {
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	dd {
		margin: 0.25rem 0 0;
		overflow-wrap: anywhere;
		font-weight: 750;
	}

	.error {
		border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
		background: var(--color-danger-soft);
		color: var(--color-danger);
		font-weight: 800;
	}

	@media (min-width: 700px) {
		.stats {
			grid-template-columns: repeat(3, 1fr);
		}

		.actions-card {
			grid-template-columns: 0.9fr 1.1fr;
			align-items: center;
		}

		.actions-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.data-card dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
