<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { getDraftItem, getSavedItems } from '$lib/itemStorage';
	import { getProject } from '$lib/projectStorage';
	import type { Item, Project } from '$lib/types';

	let project = $state<Project | null>(null);
	let items = $state<Item[]>([]);
	let draftItem = $state<Item | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state('');

	const projectId = $derived(page.params.projectId ?? '');

	onMount(() => {
		void loadItems();
	});

	async function loadItems() {
		isLoading = true;
		errorMessage = '';

		try {
			const existingProject = await getProject(projectId);
			project = existingProject ?? null;
			items = existingProject ? await getSavedItems(existingProject.id) : [];
			draftItem = existingProject ? await getDraftItem(existingProject.id) : null;
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not load items from local storage.';
		} finally {
			isLoading = false;
		}
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function formatDimensions(item: Item) {
		const dimensions = [item.length, item.width, item.height].map((value) =>
			value === null ? '—' : value
		);

		if (dimensions.every((value) => value === '—')) return 'No dimensions';
		return `${dimensions.join(' × ')} ${item.dimensionUnit}`;
	}
</script>

<svelte:head>
	<title>{project ? `Review items · ${project.name}` : 'Review items · Furniture Survey'}</title>
</svelte:head>

<a class="back-link" href={resolve('/projects/[projectId]', { projectId })}>← Project</a>

{#if isLoading}
	<section class="card state-card">Loading items…</section>
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
	<section class="review-hero">
		<div>
			<p class="eyebrow">Review</p>
			<h1>Items</h1>
			<p class="muted">{project.name} · {items.length} saved item{items.length === 1 ? '' : 's'}</p>
		</div>
		<a class="button" href={resolve('/projects/[projectId]/items/new', { projectId: project.id })}>
			{draftItem ? 'Continue draft' : 'Add item'}
		</a>
	</section>

	{#if draftItem}
		<section class="card draft-card">
			<div>
				<p class="eyebrow">Draft in progress</p>
				<strong>{draftItem.itemName.trim() || 'Untitled item'}</strong>
				<p class="muted">Last autosaved {formatDate(draftItem.updatedAt)}</p>
			</div>
			<a
				class="button secondary"
				href={resolve('/projects/[projectId]/items/new', { projectId: project.id })}
			>
				Continue
			</a>
		</section>
	{/if}

	{#if items.length === 0}
		<section class="card empty-card">
			<h2>No saved items yet</h2>
			<p class="muted">Add the first item to start building this project survey.</p>
			<a
				class="button"
				href={resolve('/projects/[projectId]/items/new', { projectId: project.id })}
			>
				Add item
			</a>
		</section>
	{:else}
		<ul class="item-list" aria-label="Saved items">
			{#each items as item (item.id)}
				<li class="card item-card">
					<div class="item-main">
						<div>
							<p class="item-number">{item.itemNumber}</p>
							<h2>{item.itemName}</h2>
							<p class="muted">{item.room} · Qty {item.quantity}</p>
						</div>
						<div class="photo-placeholder" aria-label="Photos coming in phase 3">No photos yet</div>
					</div>

					<dl>
						<div>
							<dt>Dimensions</dt>
							<dd>{formatDimensions(item)}</dd>
						</div>
						<div>
							<dt>Updated</dt>
							<dd>{formatDate(item.updatedAt)}</dd>
						</div>
						{#if item.notes.trim()}
							<div class="notes-row">
								<dt>Notes</dt>
								<dd>{item.notes}</dd>
							</div>
						{/if}
					</dl>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<style>
	.back-link {
		display: inline-flex;
		margin: 0.25rem 0 1rem;
		color: var(--color-muted);
		font-weight: 800;
		text-decoration: none;
	}

	.review-hero {
		display: grid;
		gap: 1rem;
		padding: 0.75rem 0 1.25rem;
	}

	.review-hero h1,
	.state-card h1 {
		max-width: 12ch;
		margin: 0;
		font-size: clamp(2.4rem, 14vw, 4.5rem);
		line-height: 0.95;
		letter-spacing: -0.07em;
	}

	.review-hero .button {
		width: 100%;
	}

	.state-card,
	.draft-card,
	.empty-card,
	.item-card {
		padding: 1rem;
	}

	.draft-card {
		display: grid;
		gap: 1rem;
		margin-bottom: 1rem;
		background: var(--color-primary-soft);
	}

	.draft-card strong {
		display: block;
		font-size: 1.1rem;
	}

	.draft-card .button {
		width: 100%;
	}

	h2,
	p {
		margin-top: 0;
	}

	.empty-card {
		display: grid;
		justify-items: center;
		gap: 0.8rem;
		text-align: center;
	}

	.empty-card h2 {
		margin-bottom: 0;
	}

	.item-list {
		display: grid;
		gap: 0.9rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.item-card {
		display: grid;
		gap: 1rem;
	}

	.item-main {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: start;
	}

	.item-number {
		margin-bottom: 0.35rem;
		color: var(--color-primary);
		font-size: 0.85rem;
		font-weight: 900;
		letter-spacing: 0.08em;
	}

	.item-card h2 {
		margin: 0 0 0.35rem;
		font-size: 1.25rem;
	}

	.photo-placeholder {
		display: grid;
		width: 5rem;
		height: 5rem;
		place-items: center;
		border: 1px dashed var(--color-border);
		border-radius: 1rem;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-align: center;
	}

	dl {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}

	dl div {
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
		.review-hero,
		.draft-card {
			grid-template-columns: 1fr auto;
			align-items: center;
		}

		.review-hero .button,
		.draft-card .button {
			width: auto;
		}

		dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.notes-row {
			grid-column: 1 / -1;
		}
	}
</style>
