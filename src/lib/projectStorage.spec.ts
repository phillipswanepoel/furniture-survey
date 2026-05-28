import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type FurnitureSurveyDatabase } from './db';
import {
	countProjectItems,
	createProject,
	createProjectModel,
	deleteProject,
	getProject,
	getProjects,
	normalizeProjectName
} from './projectStorage';
import type { Item, StoredImage } from './types';

let database: FurnitureSurveyDatabase;

beforeEach(() => {
	database = createDatabase(`furniture-survey-test-${crypto.randomUUID()}`, {
		indexedDB,
		IDBKeyRange
	});
});

afterEach(async () => {
	await database.delete();
	database.close();
});

describe('project storage', () => {
	it('normalizes project names and creates a project model with phase 1 defaults', () => {
		const project = createProjectModel(
			{ name: '  Ground   Floor Survey  ' },
			'2026-05-28T10:00:00.000Z'
		);

		expect(normalizeProjectName('  Ground   Floor Survey  ')).toBe('Ground Floor Survey');
		expect(project).toMatchObject({
			name: 'Ground Floor Survey',
			createdAt: '2026-05-28T10:00:00.000Z',
			updatedAt: '2026-05-28T10:00:00.000Z',
			nextItemSequence: 1,
			lastRoom: null,
			lastDimensionUnit: 'mm',
			lastExportedAt: null,
			itemCountAtLastExport: 0
		});
	});

	it('rejects blank project names', async () => {
		await expect(createProject({ name: '   ' }, database)).rejects.toThrow(
			'Project name is required'
		);
	});

	it('creates and lists projects from IndexedDB', async () => {
		const project = await createProject({ name: 'Warehouse' }, database);
		const projects = await getProjects(database);

		expect(projects).toHaveLength(1);
		expect(projects[0]).toStrictEqual(project);
	});

	it('deletes a project and its related items and images in one transaction', async () => {
		const project = await createProject({ name: 'Showroom' }, database);
		const item: Item = {
			id: 'item-1',
			projectId: project.id,
			itemNumber: 'LR-001',
			itemName: 'Chair',
			room: 'Living Room',
			quantity: 1,
			length: null,
			width: null,
			height: null,
			dimensionUnit: 'mm',
			notes: '',
			status: 'saved',
			createdAt: '2026-05-28T10:00:00.000Z',
			updatedAt: '2026-05-28T10:00:00.000Z'
		};
		const image: StoredImage = {
			id: 'image-1',
			projectId: project.id,
			itemId: item.id,
			blob: new Blob(['image-data'], { type: 'image/jpeg' }),
			filename: 'showroom_LR-001_01.jpg',
			mimeType: 'image/jpeg',
			size: 10,
			createdAt: '2026-05-28T10:00:00.000Z',
			sortOrder: 1
		};

		await database.items.add(item);
		await database.images.add(image);
		await deleteProject(project.id, database);

		expect(await getProject(project.id, database)).toBeUndefined();
		expect(await countProjectItems(project.id, database)).toBe(0);
		expect(await database.images.where('projectId').equals(project.id).count()).toBe(0);
	});

});
