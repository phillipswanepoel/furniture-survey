<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { compressAndAddImageToItem, deleteImage, getImagesForItems } from '$lib/imageStorage';
	import {
		deleteItem,
		getDraftItem,
		getSavedItems,
		ItemValidationError,
		updateSavedItem
	} from '$lib/itemStorage';
	import { getProject } from '$lib/projectStorage';
	import type { DimensionUnit, Item, Project, StoredImage } from '$lib/types';

	interface PhotoPreview {
		image: StoredImage;
		url: string;
	}

	interface ItemCard {
		item: Item;
		photos: PhotoPreview[];
	}

	interface EditItemForm {
		itemName: string;
		room: string;
		quantity: string;
		length: string;
		width: string;
		height: string;
		dimensionUnit: DimensionUnit;
		notes: string;
	}

	let project = $state<Project | null>(null);
	let itemCards = $state<ItemCard[]>([]);
	let draftItem = $state<Item | null>(null);
	let searchQuery = $state('');
	let roomFilter = $state('');
	let editForms = $state<Record<string, EditItemForm>>({});
	let savingItemId = $state<string | null>(null);
	let deletingItemId = $state<string | null>(null);
	let isLoading = $state(true);
	let addingPhotosItemId = $state<string | null>(null);
	let deletingPhotoId = $state<string | null>(null);
	let errorMessage = $state('');
	let statusMessage = $state('');

	const projectId = $derived(page.params.projectId ?? '');
	const roomOptions = $derived(
		Array.from(new Set(itemCards.map((card) => card.item.room))).sort((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base' })
		)
	);
	const filteredItemCards = $derived(
		itemCards.filter(
			(card) => matchesSearch(card.item, searchQuery) && matchesRoom(card.item, roomFilter)
		)
	);

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
		editForms = Object.fromEntries(items.map((item) => [item.id, createEditForm(item)]));
	}

	function createEditForm(item: Item): EditItemForm {
		return {
			itemName: item.itemName,
			room: item.room,
			quantity: String(item.quantity),
			length: item.length === null ? '' : String(item.length),
			width: item.width === null ? '' : String(item.width),
			height: item.height === null ? '' : String(item.height),
			dimensionUnit: item.dimensionUnit,
			notes: item.notes
		};
	}

	function matchesSearch(item: Item, query: string) {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return true;

		return [item.itemNumber, item.itemName, item.room, item.notes].some((value) =>
			value.toLowerCase().includes(normalizedQuery)
		);
	}

	function matchesRoom(item: Item, selectedRoom: string) {
		return !selectedRoom || item.room === selectedRoom;
	}

	function updateEditField<K extends keyof EditItemForm>(
		itemId: string,
		field: K,
		value: EditItemForm[K]
	) {
		const currentForm = editForms[itemId];
		if (!currentForm) return;

		editForms = {
			...editForms,
			[itemId]: { ...currentForm, [field]: value }
		};
	}

	function parseQuantity(value: string) {
		if (!value.trim()) return Number.NaN;

		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : Number.NaN;
	}

	function parseOptionalNumber(value: string) {
		if (!value.trim()) return null;

		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : Number.NaN;
	}

	async function handleSaveItem(item: Item, event: SubmitEvent) {
		event.preventDefault();
		const form = editForms[item.id];
		if (!form) return;

		savingItemId = item.id;
		errorMessage = '';
		statusMessage = '';

		try {
			const updatedItem = await updateSavedItem(item.id, {
				itemName: form.itemName,
				room: form.room,
				quantity: parseQuantity(form.quantity),
				length: parseOptionalNumber(form.length),
				width: parseOptionalNumber(form.width),
				height: parseOptionalNumber(form.height),
				dimensionUnit: form.dimensionUnit,
				notes: form.notes
			});

			statusMessage = `Updated ${updatedItem.itemNumber}.`;
			await loadItems(false);
		} catch (error) {
			console.error(error);
			if (error instanceof ItemValidationError) {
				errorMessage = Object.values(error.errors).filter(Boolean).join('. ');
			} else {
				errorMessage = 'Could not update this item.';
			}
		} finally {
			savingItemId = null;
		}
	}

	async function handleDeleteItem(item: Item) {
		if (!confirm(`Delete ${item.itemNumber} and its photos?`)) return;

		deletingItemId = item.id;
		errorMessage = '';
		statusMessage = '';

		try {
			await deleteItem(item.id);
			statusMessage = `Deleted ${item.itemNumber}.`;
			await loadItems(false);
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not delete this item.';
		} finally {
			deletingItemId = null;
		}
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
	<title>{project ? `Items review · ${project.name}` : 'Items review · Furniture Survey'}</title>
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
		<p class="muted">It may have been deleted.</p>
		<a class="button" href={resolve('/')}>Back to projects</a>
	</section>
{:else}
	<section class="review-hero">
		<div>
			<h1>Items review</h1>
			<p class="muted">{project.name}</p>
		</div>
		<a class="button" href={resolve('/projects/[projectId]/items/new', { projectId: project.id })}>
			Continue survey
		</a>
	</section>

	{#if draftItem}
		<section class="card draft-card">
			<div>
				<strong>{draftItem.itemName.trim() || 'Untitled item'}</strong>
				<p class="muted">Saved {formatDate(draftItem.updatedAt)}</p>
			</div>
			<a
				class="button secondary"
				href={resolve('/projects/[projectId]/items/new', { projectId: project.id })}
			>
				Continue survey
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
			<h2>No items yet</h2>
			<a
				class="button"
				href={resolve('/projects/[projectId]/items/new', { projectId: project.id })}
			>
				Add item
			</a>
		</section>
	{:else}
		<section class="card filter-card" aria-label="Search and filter items">
			<label for="item-search">Search</label>
			<input
				id="item-search"
				bind:value={searchQuery}
				type="search"
				placeholder="Number, name, room, notes"
				autocomplete="off"
			/>

			<label for="room-filter">Room</label>
			<select id="room-filter" bind:value={roomFilter}>
				<option value="">All rooms</option>
				{#each roomOptions as roomOption (roomOption)}
					<option value={roomOption}>{roomOption}</option>
				{/each}
			</select>

			<p class="muted result-count">
				Showing {filteredItemCards.length} of {itemCards.length}
			</p>
		</section>

		{#if filteredItemCards.length === 0}
			<section class="card empty-card">
				<h2>No matching items</h2>
				<p class="muted">Try a different search or room filter.</p>
			</section>
		{:else}
			<ul class="item-list" aria-label="Saved items">
				{#each filteredItemCards as card (card.item.id)}
					<li class="card item-card">
						<div class="item-main">
							<p class="item-number">{card.item.itemNumber}</p>
							<h2>{card.item.itemName}</h2>
							<p class="muted">{card.item.room} · Qty {card.item.quantity}</p>
						</div>

						<details class="edit-panel">
							<summary>Edit item</summary>
							<form onsubmit={(event) => handleSaveItem(card.item, event)}>
								<label>
									<span>Item number</span>
									<input value={card.item.itemNumber} readonly />
								</label>
								<label>
									<span>Item name</span>
									<input
										value={editForms[card.item.id]?.itemName ?? ''}
										oninput={(event) =>
											updateEditField(card.item.id, 'itemName', event.currentTarget.value)}
										autocomplete="off"
									/>
								</label>
								<div class="edit-two-column">
									<label>
										<span>Room</span>
										<input
											value={editForms[card.item.id]?.room ?? ''}
											oninput={(event) =>
												updateEditField(card.item.id, 'room', event.currentTarget.value)}
											autocomplete="off"
										/>
									</label>
									<label>
										<span>Quantity</span>
										<input
											value={editForms[card.item.id]?.quantity ?? '1'}
											oninput={(event) =>
												updateEditField(card.item.id, 'quantity', event.currentTarget.value)}
											inputmode="numeric"
										/>
									</label>
								</div>
								<div class="edit-dimensions">
									<input
										aria-label="Length"
										value={editForms[card.item.id]?.length ?? ''}
										oninput={(event) =>
											updateEditField(card.item.id, 'length', event.currentTarget.value)}
										placeholder="Length"
										inputmode="decimal"
									/>
									<input
										aria-label="Width"
										value={editForms[card.item.id]?.width ?? ''}
										oninput={(event) =>
											updateEditField(card.item.id, 'width', event.currentTarget.value)}
										placeholder="Width"
										inputmode="decimal"
									/>
									<input
										aria-label="Height"
										value={editForms[card.item.id]?.height ?? ''}
										oninput={(event) =>
											updateEditField(card.item.id, 'height', event.currentTarget.value)}
										placeholder="Height"
										inputmode="decimal"
									/>
									<select
										aria-label="Dimension unit"
										value={editForms[card.item.id]?.dimensionUnit ?? 'mm'}
										onchange={(event) =>
											updateEditField(
												card.item.id,
												'dimensionUnit',
												event.currentTarget.value as DimensionUnit
											)}
									>
										<option value="mm">mm</option>
										<option value="cm">cm</option>
										<option value="m">m</option>
									</select>
								</div>
								<label>
									<span>Notes</span>
									<textarea
										value={editForms[card.item.id]?.notes ?? ''}
										oninput={(event) =>
											updateEditField(card.item.id, 'notes', event.currentTarget.value)}
									></textarea>
								</label>
								<div class="edit-actions">
									<button type="submit" disabled={savingItemId === card.item.id}>
										{savingItemId === card.item.id ? 'Saving…' : 'Save changes'}
									</button>
									<button
										class="danger"
										type="button"
										onclick={() => handleDeleteItem(card.item)}
										disabled={deletingItemId === card.item.id || savingItemId === card.item.id}
									>
										{deletingItemId === card.item.id ? 'Deleting…' : 'Delete item'}
									</button>
								</div>
							</form>
						</details>

						<section class="photos-review" aria-label={`${card.item.itemNumber} photos`}>
							<div class="photos-review-heading">
								<div>
									<h3>photos</h3>
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
									{addingPhotosItemId === card.item.id ? 'Adding…' : 'Add'}
								</label>
							</div>

							{#if card.photos.length === 0}
								<p class="empty-photo-row">No photos</p>
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
								<dt>dimensions</dt>
								<dd>{formatDimensions(card.item)}</dd>
							</div>
							<div>
								<dt>updated</dt>
								<dd>{formatDate(card.item.updatedAt)}</dd>
							</div>
							{#if card.item.notes.trim()}
								<div class="notes-row">
									<dt>notes</dt>
									<dd>{card.item.notes}</dd>
								</div>
							{/if}
						</dl>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
{/if}

<style>
	.review-hero {
		display: grid;
		gap: 1rem;
		padding: 0.7rem 0 1.15rem;
	}

	.review-hero h1,
	.state-card h1 {
		max-width: 12ch;
		margin: 0;
		font-size: clamp(2.45rem, 14vw, 4.8rem);
		font-weight: 700;
		line-height: 0.92;
		letter-spacing: -0.09em;
	}

	.review-hero .button {
		width: 100%;
	}

	.state-card,
	.draft-card,
	.empty-card,
	.filter-card,
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
		font-size: 1.05rem;
		font-weight: 650;
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
		font-weight: 650;
	}

	.empty-card {
		display: grid;
		justify-items: center;
		gap: 0.8rem;
		text-align: center;
	}

	.empty-card h2 {
		margin-bottom: 0;
		font-weight: 650;
	}

	.filter-card {
		display: grid;
		gap: 0.65rem;
		margin-bottom: 1rem;
	}

	.filter-card label,
	.edit-panel label span {
		font-size: 0.85rem;
		font-weight: 650;
	}

	.result-count {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 650;
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
		gap: 0.35rem;
	}

	.item-number {
		margin-bottom: 0.35rem;
		color: var(--color-primary);
		font-size: 0.82rem;
		font-weight: 650;
		letter-spacing: 0.08em;
	}

	.item-card h2 {
		margin: 0 0 0.35rem;
		font-size: 1.2rem;
		font-weight: 650;
	}

	.edit-panel {
		border: 1px solid color-mix(in srgb, var(--color-primary) 10%, transparent);
		border-radius: 1.25rem;
		padding: 0.85rem;
		background: var(--color-surface-strong);
	}

	.edit-panel summary {
		color: var(--color-primary);
		font-weight: 700;
		cursor: pointer;
	}

	.edit-panel form {
		display: grid;
		gap: 0.8rem;
		margin-top: 0.85rem;
	}

	.edit-panel label,
	.edit-two-column,
	.edit-dimensions,
	.edit-actions {
		display: grid;
		gap: 0.65rem;
	}

	.edit-panel textarea {
		min-height: 6rem;
	}

	.edit-panel input[readonly] {
		color: var(--color-muted);
	}

	.photos-review {
		display: grid;
		gap: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 10%, transparent);
		border-radius: 1.35rem;
		padding: 0.85rem;
		background: var(--color-primary-soft);
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
		border: 1px dashed color-mix(in srgb, var(--color-primary) 20%, transparent);
		border-radius: 1rem;
		padding: 0.85rem;
		color: var(--color-muted);
		font-weight: 650;
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
		border-radius: 1rem;
		object-fit: cover;
		background: var(--color-primary-soft);
	}

	dl {
		display: grid;
		gap: 0.65rem;
		margin: 0;
	}

	dl div {
		min-width: 0;
		border: 1px solid color-mix(in srgb, var(--color-primary) 10%, transparent);
		border-radius: 1.05rem;
		padding: 0.72rem;
		background: var(--color-surface-strong);
	}

	dt {
		color: var(--color-muted);
		font-size: 0.68rem;
		font-weight: 650;
		text-transform: none;
	}

	dd {
		margin: 0.22rem 0 0;
		overflow-wrap: anywhere;
		font-weight: 650;
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

		.filter-card {
			grid-template-columns: auto minmax(12rem, 1fr) auto minmax(10rem, 0.7fr) auto;
			align-items: center;
		}

		.photos-review-heading {
			grid-template-columns: 1fr auto;
			align-items: center;
		}

		.edit-two-column {
			grid-template-columns: 1fr 8rem;
		}

		.edit-dimensions {
			grid-template-columns: repeat(3, 1fr) 7rem;
		}

		.edit-actions {
			grid-template-columns: repeat(2, 1fr);
		}

		dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.notes-row {
			grid-column: 1 / -1;
		}
	}
</style>
