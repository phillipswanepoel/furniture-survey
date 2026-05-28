import { db as defaultDb, type FurnitureSurveyDatabase } from './db';
import { updateImageFilenamesForItem } from './imageStorage';
import { generateItemNumber } from './itemNumbers';
import type { DimensionUnit, Item, Project } from './types';
import { normalizeItemText, validateItemForSave, type ItemValidationErrors } from './validation';

export interface UpdateItemFieldsInput {
	itemName?: string;
	room?: string;
	quantity?: number;
	length?: number | null;
	width?: number | null;
	height?: number | null;
	dimensionUnit?: DimensionUnit;
	notes?: string;
}

export interface FinalizeItemResult {
	item: Item;
	project: Project;
	nextDraft?: Item;
}

export class ItemValidationError extends Error {
	readonly errors: ItemValidationErrors;

	constructor(errors: ItemValidationErrors) {
		super('Item is missing required fields');
		this.name = 'ItemValidationError';
		this.errors = errors;
	}
}

function nowIso() {
	return new Date().toISOString();
}

function createId() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}

	return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createDraftItemModel(project: Project, createdAt = nowIso()): Item {
	return {
		id: createId(),
		projectId: project.id,
		itemNumber: '',
		itemName: '',
		room: project.lastRoom ?? '',
		quantity: 1,
		length: null,
		width: null,
		height: null,
		dimensionUnit: project.lastDimensionUnit,
		notes: '',
		status: 'draft',
		createdAt,
		updatedAt: createdAt
	};
}

export async function getDraftItem(
	projectId: string,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const drafts = await database.items
		.where('projectId')
		.equals(projectId)
		.filter((item) => item.status === 'draft')
		.toArray();

	return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export async function createDraftItem(
	projectId: string,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const project = await database.projects.get(projectId);

	if (!project) {
		throw new Error('Project not found');
	}

	const draft = createDraftItemModel(project);
	await database.items.add(draft);
	return draft;
}

export async function createOrRecoverDraftItem(
	projectId: string,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const draft = await getDraftItem(projectId, database);

	if (draft) {
		return { item: draft, recovered: true };
	}

	return { item: await createDraftItem(projectId, database), recovered: false };
}

export async function updateDraftItem(
	id: string,
	input: UpdateItemFieldsInput,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const existingItem = await database.items.get(id);

	if (!existingItem) {
		throw new Error('Item not found');
	}

	if (existingItem.status !== 'draft') {
		throw new Error('Saved items cannot be edited through draft autosave');
	}

	const changes: Partial<Item> = { updatedAt: nowIso() };

	if (input.itemName !== undefined) changes.itemName = input.itemName;
	if (input.room !== undefined) changes.room = input.room;
	if (input.quantity !== undefined) changes.quantity = input.quantity;
	if (input.length !== undefined) changes.length = input.length;
	if (input.width !== undefined) changes.width = input.width;
	if (input.height !== undefined) changes.height = input.height;
	if (input.dimensionUnit !== undefined) changes.dimensionUnit = input.dimensionUnit;
	if (input.notes !== undefined) changes.notes = input.notes;

	await database.items.update(id, changes);
	return { ...existingItem, ...changes };
}

async function finalizeDraft(
	id: string,
	createNextDraft: boolean,
	database: FurnitureSurveyDatabase
): Promise<FinalizeItemResult> {
	return database.transaction(
		'rw',
		database.projects,
		database.items,
		database.images,
		async () => {
			const draft = await database.items.get(id);

			if (!draft) {
				throw new Error('Item not found');
			}

			if (draft.status !== 'draft') {
				throw new Error('Item has already been saved');
			}

			const project = await database.projects.get(draft.projectId);

			if (!project) {
				throw new Error('Project not found');
			}

			const itemName = normalizeItemText(draft.itemName);
			const room = normalizeItemText(draft.room);
			const validation = validateItemForSave({ ...draft, itemName, room });

			if (!validation.valid) {
				throw new ItemValidationError(validation.errors);
			}

			const updatedAt = nowIso();
			const item: Item = {
				...draft,
				itemNumber: generateItemNumber(room, project.nextItemSequence),
				itemName,
				room,
				status: 'saved',
				updatedAt
			};
			const projectChanges: Pick<
				Project,
				'nextItemSequence' | 'lastRoom' | 'lastDimensionUnit' | 'updatedAt'
			> = {
				nextItemSequence: project.nextItemSequence + 1,
				lastRoom: room,
				lastDimensionUnit: item.dimensionUnit,
				updatedAt
			};
			const updatedProject: Project = { ...project, ...projectChanges };
			let nextDraft: Item | undefined;

			await database.items.put(item);
			await database.projects.update(project.id, projectChanges);
			await updateImageFilenamesForItem(item, updatedProject, database);

			if (createNextDraft) {
				nextDraft = createDraftItemModel(updatedProject, updatedAt);
				await database.items.add(nextDraft);
			}

			return { item, project: updatedProject, nextDraft };
		}
	);
}

export async function finalizeDraftItem(id: string, database: FurnitureSurveyDatabase = defaultDb) {
	return finalizeDraft(id, false, database);
}

export async function finalizeDraftAndCreateNext(
	id: string,
	database: FurnitureSurveyDatabase = defaultDb
) {
	return finalizeDraft(id, true, database);
}

export async function getSavedItems(
	projectId: string,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const items = await database.items
		.where('projectId')
		.equals(projectId)
		.filter((item) => item.status === 'saved')
		.toArray();

	return items.sort(
		(a, b) =>
			a.createdAt.localeCompare(b.createdAt) ||
			a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true })
	);
}

export async function countSavedProjectItems(
	projectId: string,
	database: FurnitureSurveyDatabase = defaultDb
) {
	return database.items
		.where('projectId')
		.equals(projectId)
		.filter((item) => item.status === 'saved')
		.count();
}

export async function updateSavedItem(
	id: string,
	input: UpdateItemFieldsInput,
	database: FurnitureSurveyDatabase = defaultDb
) {
	return database.transaction('rw', database.projects, database.items, async () => {
		const existingItem = await database.items.get(id);

		if (!existingItem) {
			throw new Error('Item not found');
		}

		if (existingItem.status !== 'saved') {
			throw new Error('Only saved items can be edited here');
		}

		const candidate: Item = {
			...existingItem,
			...input,
			itemName:
				input.itemName === undefined ? existingItem.itemName : normalizeItemText(input.itemName),
			room: input.room === undefined ? existingItem.room : normalizeItemText(input.room)
		};
		const validation = validateItemForSave(candidate);

		if (!validation.valid) {
			throw new ItemValidationError(validation.errors);
		}

		const updatedAt = nowIso();
		const changes: Partial<Item> = {
			itemName: candidate.itemName,
			room: candidate.room,
			quantity: candidate.quantity,
			length: candidate.length,
			width: candidate.width,
			height: candidate.height,
			dimensionUnit: candidate.dimensionUnit,
			notes: candidate.notes,
			updatedAt
		};

		await database.items.update(existingItem.id, changes);
		await database.projects.update(existingItem.projectId, { updatedAt });

		return { ...existingItem, ...changes };
	});
}

export async function deleteItem(id: string, database: FurnitureSurveyDatabase = defaultDb) {
	await database.transaction('rw', database.projects, database.items, database.images, async () => {
		const item = await database.items.get(id);
		await database.images.where('itemId').equals(id).delete();
		await database.items.delete(id);

		if (item) {
			await database.projects.update(item.projectId, { updatedAt: nowIso() });
		}
	});
}

export async function deleteDraftItem(id: string, database: FurnitureSurveyDatabase = defaultDb) {
	const item = await database.items.get(id);

	if (!item) return;
	if (item.status !== 'draft') {
		throw new Error('Only draft items can be discarded');
	}

	await deleteItem(id, database);
}
