import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type FurnitureSurveyDatabase } from './db';
import { addImageToItem } from './imageStorage';
import { createDraftItem, finalizeDraftItem, updateDraftItem } from './itemStorage';
import { createProject } from './projectStorage';
import {
	createProjectExportData,
	createProjectZip,
	generateProjectZipFilename,
	markProjectAsExported
} from './zipExport';
import type { Item, Project, StoredImage } from './types';

let database: FurnitureSurveyDatabase;

beforeEach(() => {
	database = createDatabase(`furniture-survey-export-test-${crypto.randomUUID()}`, {
		indexedDB,
		IDBKeyRange
	});
});

afterEach(async () => {
	await database.delete();
	database.close();
});

describe('ZIP export', () => {
	it('builds CSV and JSON metadata without raw image blobs', () => {
		const project: Project = {
			id: 'project-1',
			name: 'Flat Export',
			createdAt: '2026-05-28T09:00:00.000Z',
			updatedAt: '2026-05-28T09:00:00.000Z',
			nextItemSequence: 2,
			lastRoom: 'Living Room',
			lastDimensionUnit: 'mm',
			lastExportedAt: null,
			itemCountAtLastExport: 0
		};
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
			updatedAt: '2026-05-28T10:10:00.000Z'
		};
		const image: StoredImage = {
			id: 'image-1',
			projectId: project.id,
			itemId: item.id,
			blob: new Blob(['image-data'], { type: 'image/jpeg' }),
			filename: 'old-name.jpg',
			mimeType: 'image/jpeg',
			size: 10,
			createdAt: '2026-05-28T10:05:00.000Z',
			sortOrder: 1
		};

		const exportData = createProjectExportData(
			project,
			[item],
			new Map([[item.id, [image]]]),
			'2026-05-28T12:00:00.000Z'
		);
		const metadata = JSON.parse(exportData.json) as {
			items: Array<{ images: Array<Record<string, unknown>> }>;
		};

		expect(exportData.filename).toBe('flat-export_2026-05-28.zip');
		expect(exportData.csv).toContain('flat-export_LR-001_01.jpg');
		expect(metadata.items[0].images[0].filename).toBe('flat-export_LR-001_01.jpg');
		expect(metadata.items[0].images[0]).not.toHaveProperty('blob');
	});

	it('creates a ZIP with CSV, JSON, and image files', async () => {
		const project = await createProject({ name: 'Flat 10 Export' }, database);
		const draft = await createDraftItem(project.id, database);
		await updateDraftItem(draft.id, { itemName: 'Sofa', room: 'Lounge', quantity: 1 }, database);
		const result = await finalizeDraftItem(draft.id, database);
		await addImageToItem(
			result.item.id,
			new Blob(['image-data'], { type: 'image/jpeg' }),
			database
		);

		const zipExport = await createProjectZip(project.id, database, '2026-05-28T13:00:00.000Z');
		const zip = await JSZip.loadAsync(await zipExport.blob.arrayBuffer());
		const csv = await zip.file('items.csv')?.async('string');
		const json = await zip.file('items.json')?.async('string');
		const image = await zip.file('images/flat-10-export_LR-001_01.jpg')?.async('string');

		expect(zipExport.filename).toBe('flat-10-export_2026-05-28.zip');
		expect(csv).toContain('LR-001,Sofa,Lounge');
		expect(json).toContain('"imageCount": 1');
		expect(image).toBe('image-data');
	});

	it('marks a project as exported with the saved item count', async () => {
		const project = await createProject({ name: 'Mark Exported' }, database);

		const updated = await markProjectAsExported(
			project.id,
			{ itemCount: 3, exportedAt: '2026-05-28T14:00:00.000Z' },
			database
		);

		expect(updated.lastExportedAt).toBe('2026-05-28T14:00:00.000Z');
		expect(updated.itemCountAtLastExport).toBe(3);
		expect(updated.updatedAt).toBe('2026-05-28T14:00:00.000Z');
	});

	it('generates dated ZIP filenames from project names', () => {
		expect(generateProjectZipFilename('  24 High Street & Annex  ', '2026-05-28T15:00:00Z')).toBe(
			'24-high-street-and-annex_2026-05-28.zip'
		);
	});
});
