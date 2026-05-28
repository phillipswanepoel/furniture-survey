import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type FurnitureSurveyDatabase } from './db';
import { addImageToItem } from './imageStorage';
import {
	countSavedProjectItems,
	createDraftItem,
	createOrRecoverDraftItem,
	deleteDraftItem,
	deleteItem,
	finalizeDraftAndCreateNext,
	finalizeDraftItem,
	getDraftItem,
	getSavedItems,
	ItemValidationError,
	updateDraftItem
} from './itemStorage';
import { createProject, updateProject } from './projectStorage';

let database: FurnitureSurveyDatabase;

beforeEach(() => {
	database = createDatabase(`furniture-survey-item-test-${crypto.randomUUID()}`, {
		indexedDB,
		IDBKeyRange
	});
});

afterEach(async () => {
	await database.delete();
	database.close();
});

describe('item storage', () => {
	it('creates draft items using project carry-over defaults', async () => {
		const project = await createProject({ name: 'Flat 1' }, database);
		await updateProject(project.id, { lastRoom: 'Kitchen', lastDimensionUnit: 'cm' }, database);

		const draft = await createDraftItem(project.id, database);

		expect(draft).toMatchObject({
			projectId: project.id,
			itemNumber: '',
			itemName: '',
			room: 'Kitchen',
			quantity: 1,
			dimensionUnit: 'cm',
			status: 'draft'
		});
	});

	it('recovers the latest existing draft instead of creating another draft', async () => {
		const project = await createProject({ name: 'Flat 2' }, database);
		const draft = await createDraftItem(project.id, database);
		await updateDraftItem(draft.id, { itemName: 'Recovered chair' }, database);

		const recovered = await createOrRecoverDraftItem(project.id, database);
		const draftCount = await database.items
			.where('projectId')
			.equals(project.id)
			.filter((item) => item.status === 'draft')
			.count();

		expect(recovered.recovered).toBe(true);
		expect(recovered.item.id).toBe(draft.id);
		expect(draftCount).toBe(1);
	});

	it('validates required fields before final save', async () => {
		const project = await createProject({ name: 'Flat 3' }, database);
		const draft = await createDraftItem(project.id, database);

		await expect(finalizeDraftItem(draft.id, database)).rejects.toBeInstanceOf(ItemValidationError);
	});

	it('finalizes a draft with a room-coded item number and updates project sequence', async () => {
		const project = await createProject({ name: 'Flat 4' }, database);
		const draft = await createDraftItem(project.id, database);
		await updateDraftItem(
			draft.id,
			{
				itemName: '  Oak   chair ',
				room: ' Living   Room ',
				quantity: 2,
				dimensionUnit: 'mm'
			},
			database
		);

		const result = await finalizeDraftItem(draft.id, database);
		const savedItems = await getSavedItems(project.id, database);

		expect(result.item).toMatchObject({
			id: draft.id,
			itemNumber: 'LR-001',
			itemName: 'Oak chair',
			room: 'Living Room',
			quantity: 2,
			status: 'saved'
		});
		expect(result.project).toMatchObject({
			nextItemSequence: 2,
			lastRoom: 'Living Room',
			lastDimensionUnit: 'mm'
		});
		expect(savedItems).toHaveLength(1);
	});

	it('save and add next carries room and unit while resetting quantity', async () => {
		const project = await createProject({ name: 'Flat 5' }, database);
		const draft = await createDraftItem(project.id, database);
		await updateDraftItem(
			draft.id,
			{
				itemName: 'Table',
				room: 'Kitchen',
				quantity: 4,
				dimensionUnit: 'cm',
				notes: 'Round top'
			},
			database
		);

		const result = await finalizeDraftAndCreateNext(draft.id, database);

		expect(result.item.itemNumber).toBe('KIT-001');
		expect(result.nextDraft).toMatchObject({
			projectId: project.id,
			itemNumber: '',
			itemName: '',
			room: 'Kitchen',
			quantity: 1,
			dimensionUnit: 'cm',
			notes: '',
			status: 'draft'
		});
		expect(result.project.nextItemSequence).toBe(2);
	});

	it('lists and counts only saved items', async () => {
		const project = await createProject({ name: 'Flat 6' }, database);
		const firstDraft = await createDraftItem(project.id, database);
		await updateDraftItem(
			firstDraft.id,
			{ itemName: 'Sofa', room: 'Lounge', quantity: 1 },
			database
		);
		await finalizeDraftAndCreateNext(firstDraft.id, database);

		const savedItems = await getSavedItems(project.id, database);
		const savedCount = await countSavedProjectItems(project.id, database);
		const draft = await getDraftItem(project.id, database);

		expect(savedItems.map((item) => item.itemNumber)).toStrictEqual(['LR-001']);
		expect(savedCount).toBe(1);
		expect(draft?.status).toBe('draft');
	});

	it('deletes saved items and their related images', async () => {
		const project = await createProject({ name: 'Flat 7' }, database);
		const draft = await createDraftItem(project.id, database);
		await updateDraftItem(draft.id, { itemName: 'Cabinet', room: 'Storage' }, database);
		const result = await finalizeDraftItem(draft.id, database);
		await addImageToItem(
			result.item.id,
			new Blob(['image-data'], { type: 'image/jpeg' }),
			database
		);

		await deleteItem(result.item.id, database);

		expect(await database.items.get(result.item.id)).toBeUndefined();
		expect(await database.images.where('itemId').equals(result.item.id).count()).toBe(0);
	});

	it('discards draft items', async () => {
		const project = await createProject({ name: 'Flat 8' }, database);
		const draft = await createDraftItem(project.id, database);

		await deleteDraftItem(draft.id, database);

		expect(await getDraftItem(project.id, database)).toBeNull();
	});
});
