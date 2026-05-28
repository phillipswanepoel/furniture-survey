<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { compressAndAddImageToItem, deleteImage, getImagesForItems } from '$lib/imageStorage';
	import { getDraftItem, getSavedItems } from '$lib/itemStorage';
	import { getProject } from '$lib/projectStorage';
	import type { Item, Project, StoredImage } from '$lib/types';

	interface PhotoPreview {
		image: StoredImage;
		url: string;
	}

	interface ItemCard {
		item: Item;
		photos: PhotoPreview[];
	}

	let project = $state<Project | null>(null);
	let itemCards = $state<ItemCard[]>([]);
	let draftItem = $state<Item | null>(null);
	let isLoading = $state(true);
	let addingPhotosItemId = $state<string | null>(null);
	let deletingPhotoId = $state<string | null>(null);
	let errorMessage = $state('');
	let statusMessage = $state('');

	const projectId = $derived(page.params.projectId ?? '');

	onMount(() => {
		void loadItems();
	});

	onDestroy(() => {
		revokeItemCardUrls();
	});

	async function loadItems(showSpinner = true) {
		if (showSpinner) isLoading = true;
		errorMessage = '';

		try {
			const existingProject = await getProject(projectId);
			project = existingProject ?? null;
			draftItem = existingProject ? await getDraftItem(existingProject.id) : null;

			if (!existingProject) {
				setItemCards([], new Map());
				return;
			}

			const savedItems = await getSavedItems(existingProject.id);
			const imageGroups = await getImagesForItems(savedItems.map((item) => item.id));
			setItemCards(savedItems, imageGroups);
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not load items from local storage.';
		} finally {
			isLoading = false;
		}
	}

	function revokeItemCardUrls() {
		for (const card of itemCards) {
			for (const photo of card.photos) {
				URL.revokeObjectURL(photo.url);
			}
		}

		itemCards = [];
	}

	function setItemCards(items: Item[], imageGroups: Map<string, StoredImage[]>) {
		revokeItemCardUrls();
		itemCards = items.map((item) => ({
			item,
			photos: (imageGroups.get(item.id) ?? []).map((image) => ({
				image,
				url: URL.createObjectURL(image.blob)
			}))
		}));
	}

	async function handleAddPhotos(item: Item, event: Event) {
		const input = event.currentTarget;

		if (!(input instanceof HTMLInputElement)) return;

		const files = Array.from(input.files ?? []).filter(
			(file) => !file.type || file.type.startsWith('image/')
		);

		if (files.length === 0) {
			input.value = '';
			return;
		}

		addingPhotosItemId = item.id;
		errorMessage = '';
		statusMessage = '';

		try {
			for (const file of files) {
				await compressAndAddImageToItem(item.id, file);
			}

			statusMessage = `Added ${files.length} photo${files.length === 1 ? '' : 's'} to ${item.itemNumber}.`;
			await loadItems(false);
		} catch (error) {
			console.error(error);
			errorMessage = error instanceof Error ? error.message : 'Could not add photos.';
		} finally {
			addingPhotosItemId = null;
			input.value = '';
		}
	}

	async function handleDeletePhoto(image: StoredImage) {
		if (!confirm('Remove this photo from the item?')) return;

		deletingPhotoId = image.id;
		errorMessage = '';
		statusMessage = '';

		try {
			await deleteImage(image.id);
			statusMessage = 'Photo removed.';
			await loadItems(false);
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not remove this photo.';
		} finally {
			deletingPhotoId = null;
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
{:else if errorMessage && !project}
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
			<p class="muted">
				{project.name} · {itemCards.length} saved item{itemCards.length === 1 ? '' : 's'}
			</p>
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

	{#if statusMessage}
		<p class="success" role="status">{statusMessage}</p>
	{/if}

	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	{#if itemCards.length === 0}
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
			{#each itemCards as card (card.item.id)}
				<li class="card item-card">
					<div class="item-main">
						<div>
							<p class="item-number">{card.item.itemNumber}</p>
							<h2>{card.item.itemName}</h2>
							<p class="muted">{card.item.room} · Qty {card.item.quantity}</p>
						</div>
						<div class="photo-summary" aria-label={`${card.photos.length} photos`}>
							{#if card.photos.length > 0}
								<img src={card.photos[0].url} alt={`${card.item.itemNumber} photo 1`} />
								<span>{card.photos.length} photo{card.photos.length === 1 ? '' : 's'}</span>
							{:else}
								<div class="photo-placeholder">No photos</div>
							{/if}
						</div>
					</div>

					<section class="photos-review" aria-label={`${card.item.itemNumber} photos`}>
						<div class="photos-review-heading">
							<div>
								<h3>Photos</h3>
								<p class="muted">Add or remove photos for this saved item.</p>
							</div>
							<input
								class="file-input"
								id={`photos-${card.item.id}`}
								type="file"
								accept="image/*"
								multiple
								onchange={(event) => handleAddPhotos(card.item, event)}
								disabled={addingPhotosItemId === card.item.id}
							/>
							<label
								class="button secondary small-button"
								class:disabled-label={addingPhotosItemId === card.item.id}
								for={`photos-${card.item.id}`}
								aria-disabled={addingPhotosItemId === card.item.id ? 'true' : undefined}
							>
								{addingPhotosItemId === card.item.id ? 'Adding…' : 'Add photos'}
							</label>
						</div>

						{#if card.photos.length === 0}
							<p class="empty-photo-row">No photos stored for this item.</p>
						{:else}
							<ul class="thumbnail-list">
								{#each card.photos as photo (photo.image.id)}
									<li>
										<img
											src={photo.url}
											alt={`${card.item.itemNumber} photo ${photo.image.sortOrder}`}
										/>
										<button
											class="danger remove-photo"
											type="button"
											onclick={() => handleDeletePhoto(photo.image)}
											disabled={deletingPhotoId === photo.image.id}
										>
											{deletingPhotoId === photo.image.id ? 'Removing…' : 'Remove'}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</section>

					<dl>
						<div>
							<dt>Dimensions</dt>
							<dd>{formatDimensions(card.item)}</dd>
						</div>
						<div>
							<dt>Updated</dt>
							<dd>{formatDate(card.item.updatedAt)}</dd>
						</div>
						{#if card.item.notes.trim()}
							<div class="notes-row">
								<dt>Notes</dt>
								<dd>{card.item.notes}</dd>
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
	h3,
	p {
		margin-top: 0;
	}

	h3 {
		margin-bottom: 0.25rem;
		font-size: 1rem;
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

	.success,
	.error {
		border-radius: 1rem;
		padding: 0.9rem 1rem;
		font-weight: 800;
	}

	.success {
		border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
		background: var(--color-primary-soft);
		color: var(--color-primary);
	}

	.photo-summary {
		display: grid;
		justify-items: center;
		gap: 0.35rem;
		color: var(--color-muted);
		font-size: 0.78rem;
		font-weight: 800;
		text-align: center;
	}

	.photo-summary img {
		width: 5rem;
		height: 5rem;
		border-radius: 1rem;
		object-fit: cover;
		background: var(--color-primary-soft);
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

	.photos-review {
		display: grid;
		gap: 0.75rem;
		border-radius: 1rem;
		padding: 0.85rem;
		background: color-mix(in srgb, var(--color-primary-soft) 70%, transparent);
	}

	.photos-review-heading {
		display: grid;
		gap: 0.75rem;
	}

	.small-button,
	.remove-photo {
		min-height: 38px;
		padding-block: 0.6rem;
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.disabled-label {
		pointer-events: none;
	}

	.empty-photo-row {
		margin: 0;
		border: 1px dashed var(--color-border);
		border-radius: 0.85rem;
		padding: 0.85rem;
		color: var(--color-muted);
		font-weight: 800;
		text-align: center;
	}

	.thumbnail-list {
		display: flex;
		gap: 0.7rem;
		margin: 0;
		overflow-x: auto;
		padding: 0 0 0.2rem;
		list-style: none;
		scroll-snap-type: x proximity;
	}

	.thumbnail-list li {
		display: grid;
		min-width: 7.5rem;
		gap: 0.5rem;
		scroll-snap-align: start;
	}

	.thumbnail-list img {
		width: 7.5rem;
		height: 7.5rem;
		border-radius: 0.85rem;
		object-fit: cover;
		background: var(--color-primary-soft);
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
		border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
		background: var(--color-danger-soft);
		color: var(--color-danger);
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

		.photos-review-heading {
			grid-template-columns: 1fr auto;
			align-items: center;
		}

		dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.notes-row {
			grid-column: 1 / -1;
		}
	}
</style>
