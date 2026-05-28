<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { compressAndAddImageToItem, deleteImage, getImagesForItem } from '$lib/imageStorage';
	import {
		createDraftItem,
		deleteDraftItem,
		finalizeDraftAndCreateNext,
		finalizeDraftItem,
		getDraftItem,
		ItemValidationError,
		updateDraftItem,
		type UpdateItemFieldsInput
	} from '$lib/itemStorage';
	import { generateItemNumber } from '$lib/itemNumbers';
	import { getProject } from '$lib/projectStorage';
	import type { DimensionUnit, Item, Project, StoredImage } from '$lib/types';
	import { validateItemForSave, type ItemValidationErrors } from '$lib/validation';

	interface PhotoPreview {
		image: StoredImage;
		url: string;
	}

	let project = $state<Project | null>(null);
	let draftId = $state('');
	let itemName = $state('');
	let room = $state('');
	let quantityInput = $state('1');
	let lengthInput = $state('');
	let widthInput = $state('');
	let heightInput = $state('');
	let dimensionUnit = $state<DimensionUnit>('mm');
	let notes = $state('');
	let photoPreviews = $state<PhotoPreview[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let isAutosaving = $state(false);
	let isAddingPhotos = $state(false);
	let isDiscarding = $state(false);
	let deletingPhotoId = $state<string | null>(null);
	let recoveredDraft = $state(false);
	let saveAttempted = $state(false);
	let lastSavedAt = $state('');
	let errorMessage = $state('');
	let successMessage = $state('');
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	const projectId = $derived(page.params.projectId ?? '');
	const quantity = $derived(parseQuantity(quantityInput));
	const length = $derived(parseOptionalNumber(lengthInput));
	const width = $derived(parseOptionalNumber(widthInput));
	const height = $derived(parseOptionalNumber(heightInput));
	const validation = $derived(
		validateItemForSave({ itemName, room, quantity, length, width, height, dimensionUnit })
	);
	const canSave = $derived(
		Boolean(draftId && validation.valid && !isSaving && !isLoading && !isAddingPhotos)
	);
	const photoControlsDisabled = $derived(isAddingPhotos || isSaving || isDiscarding || !draftId);
	const itemNumberPreview = $derived(
		project && room.trim()
			? generateItemNumber(room, project.nextItemSequence)
			: 'Enter a room to preview'
	);

	onMount(() => {
		void loadDraft();
	});

	onDestroy(() => {
		clearAutosaveTimer();
		revokePhotoPreviews();
	});

	async function loadDraft() {
		isLoading = true;
		errorMessage = '';
		successMessage = '';

		try {
			const existingProject = await getProject(projectId);
			project = existingProject ?? null;

			if (!existingProject) return;

			const existingDraft = await getDraftItem(existingProject.id);
			let draft: Item;
			let draftImages: StoredImage[] = [];

			if (existingDraft) {
				draftImages = await getImagesForItem(existingDraft.id);
				const hasRecoverableContent = draftHasUserContent(
					existingDraft,
					existingProject,
					draftImages.length
				);

				if (
					hasRecoverableContent &&
					!confirm('Continue your saved draft? Choose Cancel to discard it and start a new item.')
				) {
					await deleteDraftItem(existingDraft.id);
					draft = await createDraftItem(existingProject.id);
					draftImages = [];
					recoveredDraft = false;
				} else {
					draft = existingDraft;
					recoveredDraft = hasRecoverableContent;
				}
			} else {
				draft = await createDraftItem(existingProject.id);
				recoveredDraft = false;
			}

			populateDraft(draft);
			setPhotoPreviews(draftImages);
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not load the item draft from local storage.';
		} finally {
			isLoading = false;
		}
	}

	function populateDraft(draft: Item) {
		draftId = draft.id;
		itemName = draft.itemName;
		room = draft.room;
		quantityInput = String(draft.quantity || 1);
		lengthInput = draft.length === null ? '' : String(draft.length);
		widthInput = draft.width === null ? '' : String(draft.width);
		heightInput = draft.height === null ? '' : String(draft.height);
		dimensionUnit = draft.dimensionUnit;
		notes = draft.notes;
		lastSavedAt = draft.updatedAt;
	}

	function draftHasUserContent(draft: Item, existingProject: Project, photoCount = 0) {
		return Boolean(
			photoCount > 0 ||
			draft.itemName.trim() ||
			isChangedText(draft.room, existingProject.lastRoom ?? '') ||
			draft.quantity !== 1 ||
			draft.length !== null ||
			draft.width !== null ||
			draft.height !== null ||
			draft.dimensionUnit !== existingProject.lastDimensionUnit ||
			draft.notes.trim()
		);
	}

	function isChangedText(value: string, defaultValue: string) {
		return value.trim().replace(/\s+/g, ' ') !== defaultValue.trim().replace(/\s+/g, ' ');
	}

	function revokePhotoPreviews() {
		for (const preview of photoPreviews) {
			URL.revokeObjectURL(preview.url);
		}

		photoPreviews = [];
	}

	function setPhotoPreviews(images: StoredImage[]) {
		revokePhotoPreviews();
		photoPreviews = images.map((image) => ({ image, url: URL.createObjectURL(image.blob) }));
	}

	async function refreshPhotoPreviews() {
		if (!draftId) {
			setPhotoPreviews([]);
			return;
		}

		setPhotoPreviews(await getImagesForItem(draftId));
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

	function draftOptionalNumber(value: string) {
		const parsed = parseOptionalNumber(value);
		return parsed !== null && Number.isFinite(parsed) ? parsed : null;
	}

	function collectDraftFields(): UpdateItemFieldsInput {
		return {
			itemName,
			room,
			quantity: Number.isFinite(quantity) ? quantity : 1,
			length: draftOptionalNumber(lengthInput),
			width: draftOptionalNumber(widthInput),
			height: draftOptionalNumber(heightInput),
			dimensionUnit,
			notes
		};
	}

	function clearAutosaveTimer() {
		if (!saveTimer) return;
		clearTimeout(saveTimer);
		saveTimer = null;
	}

	function scheduleAutosave() {
		if (!draftId || isLoading || isSaving || isDiscarding) return;

		successMessage = '';
		clearAutosaveTimer();
		saveTimer = setTimeout(() => {
			void saveDraftNow();
		}, 350);
	}

	async function saveDraftNow() {
		if (!draftId) return;

		isAutosaving = true;

		try {
			const draft = await updateDraftItem(draftId, collectDraftFields());
			lastSavedAt = draft.updatedAt;
			errorMessage = '';
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not autosave this draft.';
		} finally {
			isAutosaving = false;
		}
	}

	async function handlePhotoFiles(event: Event) {
		const input = event.currentTarget;

		if (!(input instanceof HTMLInputElement)) return;

		const files = Array.from(input.files ?? []).filter(
			(file) => !file.type || file.type.startsWith('image/')
		);

		if (files.length === 0) {
			input.value = '';
			return;
		}

		if (!draftId || isSaving || isDiscarding) {
			errorMessage = 'Wait for the draft to be ready before adding photos.';
			input.value = '';
			return;
		}

		isAddingPhotos = true;
		errorMessage = '';
		successMessage = '';
		clearAutosaveTimer();

		try {
			isAutosaving = true;
			const draft = await updateDraftItem(draftId, collectDraftFields());
			lastSavedAt = draft.updatedAt;
			isAutosaving = false;

			for (const file of files) {
				await compressAndAddImageToItem(draftId, file);
			}

			await refreshPhotoPreviews();
			lastSavedAt = new Date().toISOString();
			successMessage = `Added ${files.length} photo${files.length === 1 ? '' : 's'}.`;
		} catch (error) {
			console.error(error);
			errorMessage = error instanceof Error ? error.message : 'Could not add photos.';
		} finally {
			isAutosaving = false;
			isAddingPhotos = false;
			input.value = '';
		}
	}

	async function handleDeletePhoto(image: StoredImage) {
		if (!confirm('Remove this photo from the item?')) return;

		deletingPhotoId = image.id;
		errorMessage = '';
		successMessage = '';

		try {
			await deleteImage(image.id);
			await refreshPhotoPreviews();
			lastSavedAt = new Date().toISOString();
			successMessage = 'Photo removed.';
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not remove this photo.';
		} finally {
			deletingPhotoId = null;
		}
	}

	async function handleSave(event: SubmitEvent) {
		event.preventDefault();
		await saveCurrentDraft(false);
	}

	async function handleSaveAndAddNext() {
		await saveCurrentDraft(true);
	}

	async function saveCurrentDraft(addNext: boolean) {
		saveAttempted = true;
		successMessage = '';

		if (!draftId || !validation.valid) return;

		isSaving = true;
		errorMessage = '';
		clearAutosaveTimer();

		try {
			await updateDraftItem(draftId, collectDraftFields());
			const result = addNext
				? await finalizeDraftAndCreateNext(draftId)
				: await finalizeDraftItem(draftId);

			project = result.project;

			if (!addNext) {
				location.href = resolve('/projects/[projectId]/items', { projectId: result.project.id });
				return;
			}

			if (!result.nextDraft) {
				throw new Error('Could not create the next draft');
			}

			populateDraft(result.nextDraft);
			setPhotoPreviews([]);
			saveAttempted = false;
			recoveredDraft = false;
			successMessage = `Saved ${result.item.itemNumber}. Ready for the next item.`;
		} catch (error) {
			console.error(error);

			if (error instanceof ItemValidationError) {
				errorMessage = formatValidationErrors(error.errors);
			} else {
				errorMessage = 'Could not save this item.';
			}
		} finally {
			isSaving = false;
		}
	}

	async function handleDiscardDraft() {
		if (!draftId) return;
		if (!confirm('Discard this item draft?')) return;

		isDiscarding = true;
		errorMessage = '';
		clearAutosaveTimer();

		try {
			await deleteDraftItem(draftId);
			location.href = resolve('/projects/[projectId]', { projectId });
		} catch (error) {
			console.error(error);
			errorMessage = 'Could not discard this draft.';
			isDiscarding = false;
		}
	}

	function formatValidationErrors(errors: ItemValidationErrors) {
		const messages = Object.values(errors).filter(Boolean);
		return messages.length > 0 ? messages.join('. ') : 'Complete the required fields.';
	}

	function formatTime(value: string) {
		return new Intl.DateTimeFormat(undefined, {
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function formatBytes(value: number) {
		if (value < 1024) return `${value} B`;
		if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
		return `${(value / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<svelte:head>
	<title>{project ? `Add item · ${project.name}` : 'Add item · Furniture Survey'}</title>
</svelte:head>

<a class="back-link" href={resolve('/projects/[projectId]', { projectId })}>← Project</a>

{#if isLoading}
	<section class="card state-card">Loading item draft…</section>
{:else if !project}
	<section class="card state-card">
		<p class="eyebrow">Not found</p>
		<h1>Project not found</h1>
		<p class="muted">This project may have been deleted from this device.</p>
		<a class="button" href={resolve('/')}>Back to projects</a>
	</section>
{:else}
	<section class="item-hero">
		<p class="eyebrow">Item entry</p>
		<h1>Add item</h1>
		<p class="muted">Project: {project.name}</p>
	</section>

	{#if recoveredDraft}
		<section class="card notice-card" role="status">
			<strong>Recovered draft</strong>
			<span>Continue editing this locally autosaved item, or discard it below.</span>
		</section>
	{/if}

	{#if successMessage}
		<p class="success" role="status">{successMessage}</p>
	{/if}

	{#if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{/if}

	<section class="card form-card" aria-labelledby="item-form-heading">
		<div class="form-heading">
			<div>
				<p class="eyebrow">Draft</p>
				<h2 id="item-form-heading">Item details</h2>
				<p class="muted">Draft fields autosave on this device before final save.</p>
			</div>
			<div class="number-preview" aria-label="Item number preview">
				<small>Item number</small>
				<strong>{itemNumberPreview}</strong>
			</div>
		</div>

		<section class="photo-card" aria-labelledby="photos-heading">
			<div class="photo-heading">
				<div>
					<h3 id="photos-heading">Photos</h3>
					<p class="muted">Take or add multiple photos. Images compress before local storage.</p>
				</div>
				<strong>{photoPreviews.length} photo{photoPreviews.length === 1 ? '' : 's'}</strong>
			</div>

			<div class="photo-actions">
				<input
					class="file-input"
					id="camera-photo"
					type="file"
					accept="image/*"
					capture="environment"
					onchange={handlePhotoFiles}
					disabled={photoControlsDisabled}
				/>
				<label
					class="button"
					class:disabled-label={photoControlsDisabled}
					for="camera-photo"
					aria-disabled={photoControlsDisabled ? 'true' : undefined}
				>
					{isAddingPhotos ? 'Adding…' : 'Take photo'}
				</label>

				<input
					class="file-input"
					id="library-photos"
					type="file"
					accept="image/*"
					multiple
					onchange={handlePhotoFiles}
					disabled={photoControlsDisabled}
				/>
				<label
					class="button secondary"
					class:disabled-label={photoControlsDisabled}
					for="library-photos"
					aria-disabled={photoControlsDisabled ? 'true' : undefined}
				>
					Add from library
				</label>
			</div>

			{#if photoPreviews.length === 0}
				<p class="empty-photos">No photos added yet.</p>
			{:else}
				<ul class="photo-grid" aria-label="Draft photos">
					{#each photoPreviews as preview (preview.image.id)}
						<li>
							<img src={preview.url} alt={`Item photo ${preview.image.sortOrder}`} />
							<div>
								<strong>Photo {preview.image.sortOrder}</strong>
								<small>{formatBytes(preview.image.size)}</small>
							</div>
							<button
								class="danger remove-photo"
								type="button"
								onclick={() => handleDeletePhoto(preview.image)}
								disabled={deletingPhotoId === preview.image.id || isAddingPhotos}
							>
								{deletingPhotoId === preview.image.id ? 'Removing…' : 'Remove'}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<form onsubmit={handleSave}>
			<div class="field">
				<label for="item-name">Item name <span aria-hidden="true">*</span></label>
				<input
					id="item-name"
					bind:value={itemName}
					autocomplete="off"
					placeholder="e.g. Oak dining chair"
					oninput={scheduleAutosave}
					aria-invalid={saveAttempted && validation.errors.itemName ? 'true' : undefined}
				/>
				{#if saveAttempted && validation.errors.itemName}
					<small class="field-error">{validation.errors.itemName}</small>
				{/if}
			</div>

			<div class="two-column">
				<div class="field">
					<label for="room">Room <span aria-hidden="true">*</span></label>
					<input
						id="room"
						bind:value={room}
						autocomplete="off"
						placeholder="e.g. Living Room"
						oninput={scheduleAutosave}
						aria-invalid={saveAttempted && validation.errors.room ? 'true' : undefined}
					/>
					{#if saveAttempted && validation.errors.room}
						<small class="field-error">{validation.errors.room}</small>
					{/if}
				</div>

				<div class="field">
					<label for="quantity">Quantity <span aria-hidden="true">*</span></label>
					<input
						id="quantity"
						type="text"
						inputmode="numeric"
						bind:value={quantityInput}
						oninput={scheduleAutosave}
						aria-invalid={saveAttempted && validation.errors.quantity ? 'true' : undefined}
					/>
					{#if saveAttempted && validation.errors.quantity}
						<small class="field-error">{validation.errors.quantity}</small>
					{/if}
				</div>
			</div>

			<div class="field dimensions-field">
				<div class="label-row">
					<label for="length">Dimensions</label>
					<select
						id="unit"
						bind:value={dimensionUnit}
						onchange={scheduleAutosave}
						aria-label="Dimension unit"
					>
						<option value="mm">mm</option>
						<option value="cm">cm</option>
						<option value="m">m</option>
					</select>
				</div>

				<div class="dimensions-grid">
					<input
						id="length"
						type="text"
						inputmode="decimal"
						bind:value={lengthInput}
						placeholder="Length"
						oninput={scheduleAutosave}
						aria-invalid={saveAttempted && validation.errors.length ? 'true' : undefined}
					/>
					<input
						id="width"
						type="text"
						inputmode="decimal"
						bind:value={widthInput}
						placeholder="Width"
						oninput={scheduleAutosave}
						aria-invalid={saveAttempted && validation.errors.width ? 'true' : undefined}
					/>
					<input
						id="height"
						type="text"
						inputmode="decimal"
						bind:value={heightInput}
						placeholder="Height"
						oninput={scheduleAutosave}
						aria-invalid={saveAttempted && validation.errors.height ? 'true' : undefined}
					/>
				</div>

				{#if saveAttempted && (validation.errors.length || validation.errors.width || validation.errors.height)}
					<small class="field-error">
						{validation.errors.length ?? validation.errors.width ?? validation.errors.height}
					</small>
				{/if}
			</div>

			<div class="field">
				<label for="notes">Notes</label>
				<textarea
					id="notes"
					bind:value={notes}
					placeholder="Condition, location notes, special handling…"
					oninput={scheduleAutosave}
				></textarea>
			</div>

			<div class="form-footer">
				<p class="autosave-status" aria-live="polite">
					{#if isAutosaving}
						Saving draft…
					{:else if lastSavedAt}
						Draft saved {formatTime(lastSavedAt)}
					{:else}
						Draft autosaves locally.
					{/if}
				</p>

				{#if !validation.valid}
					<p class="validation-hint">{formatValidationErrors(validation.errors)}</p>
				{/if}

				<div class="actions">
					<button type="submit" disabled={!canSave}>
						{isSaving ? 'Saving…' : 'Save item'}
					</button>
					<button
						class="secondary"
						type="button"
						onclick={handleSaveAndAddNext}
						disabled={!canSave}
					>
						Save & Add Next
					</button>
					<button
						class="danger"
						type="button"
						onclick={handleDiscardDraft}
						disabled={isSaving || isDiscarding || isAddingPhotos}
					>
						{isDiscarding ? 'Discarding…' : 'Discard draft'}
					</button>
				</div>
			</div>
		</form>
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

	.item-hero {
		padding: 0.75rem 0 1.25rem;
	}

	.item-hero h1,
	.state-card h1 {
		max-width: 12ch;
		margin: 0;
		font-size: clamp(2.4rem, 14vw, 4.5rem);
		line-height: 0.95;
		letter-spacing: -0.07em;
	}

	.item-hero .muted {
		margin-top: 0.8rem;
	}

	.state-card,
	.notice-card,
	.form-card {
		padding: 1rem;
	}

	.notice-card {
		display: grid;
		gap: 0.25rem;
		margin-bottom: 1rem;
		background: var(--color-primary-soft);
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

	.error {
		border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
		background: var(--color-danger-soft);
		color: var(--color-danger);
	}

	.form-card {
		display: grid;
		gap: 1rem;
	}

	.form-heading {
		display: grid;
		gap: 1rem;
	}

	h2,
	h3,
	p {
		margin-top: 0;
	}

	h2,
	h3 {
		margin-bottom: 0.35rem;
	}

	.number-preview {
		display: grid;
		gap: 0.25rem;
		border-radius: 1rem;
		padding: 0.85rem;
		background: var(--color-primary-soft);
	}

	.number-preview small {
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.number-preview strong {
		font-size: 1.25rem;
	}

	.photo-card {
		display: grid;
		gap: 0.9rem;
		border-radius: 1rem;
		padding: 0.85rem;
		background: color-mix(in srgb, var(--color-primary-soft) 70%, transparent);
	}

	.photo-heading {
		display: grid;
		gap: 0.5rem;
	}

	.photo-heading strong {
		color: var(--color-primary);
		font-weight: 900;
	}

	.photo-actions {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.65rem;
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

	.empty-photos {
		margin: 0;
		border: 1px dashed var(--color-border);
		border-radius: 1rem;
		padding: 1rem;
		color: var(--color-muted);
		font-weight: 800;
		text-align: center;
	}

	.photo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.photo-grid li {
		display: grid;
		gap: 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		padding: 0.55rem;
		background: var(--color-surface-strong);
	}

	.photo-grid img {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 0.75rem;
		object-fit: cover;
		background: var(--color-primary-soft);
	}

	.photo-grid strong,
	.photo-grid small {
		display: block;
	}

	.photo-grid small {
		margin-top: 0.15rem;
		color: var(--color-muted);
		font-weight: 700;
	}

	.remove-photo {
		min-height: 38px;
		padding-block: 0.6rem;
	}

	form,
	.field,
	.form-footer {
		display: grid;
		gap: 0.8rem;
	}

	label {
		font-weight: 800;
	}

	label span,
	.field-error,
	.validation-hint {
		color: var(--color-danger);
	}

	.field-error,
	.validation-hint,
	.autosave-status {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.autosave-status {
		color: var(--color-muted);
	}

	.two-column,
	.dimensions-grid,
	.actions {
		display: grid;
		gap: 0.8rem;
	}

	.label-row {
		display: grid;
		grid-template-columns: 1fr 7rem;
		gap: 0.75rem;
		align-items: center;
	}

	.label-row select {
		min-height: 42px;
		padding-block: 0.55rem;
	}

	textarea {
		min-height: 8rem;
	}

	.actions button {
		width: 100%;
	}

	@media (min-width: 700px) {
		.form-heading {
			grid-template-columns: 1fr auto;
			align-items: start;
		}

		.number-preview {
			min-width: 13rem;
		}

		.photo-heading,
		.photo-actions {
			grid-template-columns: 1fr auto;
			align-items: center;
		}

		.two-column {
			grid-template-columns: 1fr 10rem;
		}

		.dimensions-grid {
			grid-template-columns: repeat(3, 1fr);
		}

		.actions {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
