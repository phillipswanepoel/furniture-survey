import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type FurnitureSurveyDatabase } from './db';
import { addImageToItem, deleteImage, getImagesForItem, getImagesForItems } from './imageStorage';
import { createDraftItem, finalizeDraftItem, updateDraftItem } from './itemStorage';
import { createProject } from './projectStorage';

let database: FurnitureSurveyDatabase;

beforeEach(() => {
	database = createDatabase(`furniture-survey-image-test-${crypto.randomUUID()}`, {
		indexedDB,
		IDBKeyRange
	});
});

afterEach(async () => {
	await database.delete();
	database.close();
});

describe('image storage', () => {
	it('saves image blobs with item/project metadata', async () => {
		const project = await createProject({ name: 'Flat Photos' }, database);
		const draft = await createDraftItem(project.id, database);
		await database.items.update(draft.id, { updatedAt: '2026-05-01T10:00:00.000Z' });
		await database.projects.update(project.id, { updatedAt: '2026-05-01T10:00:00.000Z' });
		const blob = new Blob(['image-data'], { type: 'image/png' });

		const image = await addImageToItem(draft.id, blob, database, {
			createdAt: '2026-05-28T10:00:00.000Z'
		});
		const images = await getImagesForItem(draft.id, database);
		const updatedDraft = await database.items.get(draft.id);
		const updatedProject = await database.projects.get(project.id);

		expect(image).toMatchObject({
			projectId: project.id,
			itemId: draft.id,
			filename: expect.stringMatching(/^flat-photos_draft-.+_01\.png$/),
			mimeType: 'image/png',
			size: blob.size,
			createdAt: '2026-05-28T10:00:00.000Z',
			sortOrder: 1
		});
		expect(images).toHaveLength(1);
		expect(await images[0].blob.text()).toBe('image-data');
		expect(updatedDraft?.updatedAt).not.toBe('2026-05-01T10:00:00.000Z');
		expect(updatedProject?.updatedAt).not.toBe('2026-05-01T10:00:00.000Z');
	});

	it('groups images for multiple item cards in sort order', async () => {
		const project = await createProject({ name: 'Grouped Photos' }, database);
		const firstDraft = await createDraftItem(project.id, database);
		await updateDraftItem(firstDraft.id, { itemName: 'Chair', room: 'Living Room' }, database);
		const firstResult = await finalizeDraftItem(firstDraft.id, database);
		const secondDraft = await createDraftItem(project.id, database);
		await updateDraftItem(secondDraft.id, { itemName: 'Table', room: 'Kitchen' }, database);
		const secondResult = await finalizeDraftItem(secondDraft.id, database);

		await addImageToItem(secondResult.item.id, new Blob(['two'], { type: 'image/jpeg' }), database);
		await addImageToItem(
			firstResult.item.id,
			new Blob(['one-a'], { type: 'image/jpeg' }),
			database
		);
		await addImageToItem(
			firstResult.item.id,
			new Blob(['one-b'], { type: 'image/jpeg' }),
			database
		);

		const groups = await getImagesForItems([firstResult.item.id, secondResult.item.id], database);

		expect(groups.get(firstResult.item.id)?.map((image) => image.sortOrder)).toStrictEqual([1, 2]);
		expect(groups.get(secondResult.item.id)?.map((image) => image.sortOrder)).toStrictEqual([1]);
	});

	it('renames draft image filenames when the item is finalized', async () => {
		const project = await createProject({ name: 'Flat 9' }, database);
		const draft = await createDraftItem(project.id, database);
		await addImageToItem(draft.id, new Blob(['image-data'], { type: 'image/jpeg' }), database);
		await updateDraftItem(draft.id, { itemName: 'Table', room: 'Kitchen', quantity: 1 }, database);

		const result = await finalizeDraftItem(draft.id, database);
		const images = await getImagesForItem(result.item.id, database);

		expect(result.item.itemNumber).toBe('KIT-001');
		expect(images[0].filename).toBe('flat-9_KIT-001_01.jpg');
	});

	it('deletes photos and renumbers remaining filenames', async () => {
		const project = await createProject({ name: 'Remove Photos' }, database);
		const draft = await createDraftItem(project.id, database);
		await updateDraftItem(draft.id, { itemName: 'Lamp', room: 'Office' }, database);
		const result = await finalizeDraftItem(draft.id, database);
		const first = await addImageToItem(
			result.item.id,
			new Blob(['first'], { type: 'image/jpeg' }),
			database
		);
		const second = await addImageToItem(
			result.item.id,
			new Blob(['second'], { type: 'image/jpeg' }),
			database
		);
		const third = await addImageToItem(
			result.item.id,
			new Blob(['third'], { type: 'image/jpeg' }),
			database
		);

		await deleteImage(second.id, database);
		const remainingImages = await getImagesForItem(result.item.id, database);

		expect(first.id).not.toBe(third.id);
		expect(remainingImages.map((image) => image.id)).toStrictEqual([first.id, third.id]);
		expect(remainingImages.map((image) => image.sortOrder)).toStrictEqual([1, 2]);
		expect(remainingImages.map((image) => image.filename)).toStrictEqual([
			'remove-photos_OFF-001_01.jpg',
			'remove-photos_OFF-001_02.jpg'
		]);
		expect(await database.images.get(second.id)).toBeUndefined();
	});
});
