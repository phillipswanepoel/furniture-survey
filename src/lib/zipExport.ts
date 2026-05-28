import JSZip from 'jszip';
import { db as defaultDb, type FurnitureSurveyDatabase } from './db';
import { generateItemsCsv, type ItemCsvRecord } from './csvExport';
import { filenameSafePart, generateImageFilename } from './filenames';
import { getImagesForItems } from './imageStorage';
import { getSavedItems } from './itemStorage';
import type { Item, Project, StoredImage } from './types';

export interface ExportImageMetadata {
	id: string;
	projectId: string;
	itemId: string;
	filename: string;
	mimeType: string;
	size: number;
	createdAt: string;
	sortOrder: number;
}

export interface ExportItemMetadata extends Item {
	images: ExportImageMetadata[];
}

export interface ProjectExportMetadata {
	project: Project;
	exportedAt: string;
	itemCount: number;
	imageCount: number;
	items: ExportItemMetadata[];
}

export interface ZipImageEntry {
	imageId: string;
	itemId: string;
	filename: string;
	blob: Blob;
}

export interface ProjectExportData {
	filename: string;
	metadata: ProjectExportMetadata;
	csv: string;
	json: string;
	imageEntries: ZipImageEntry[];
}

export interface ProjectZipExport extends ProjectExportData {
	blob: Blob;
}

export interface MarkProjectExportedInput {
	itemCount: number;
	exportedAt?: string;
}

function nowIso() {
	return new Date().toISOString();
}

export function formatExportDate(value: string) {
	if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

	const date = new Date(value);

	if (Number.isNaN(date.valueOf())) {
		throw new Error('Export date is invalid');
	}

	return date.toISOString().slice(0, 10);
}

export function generateProjectZipFilename(projectName: string, exportedAt = nowIso()) {
	const projectPart = filenameSafePart(projectName, 'project', true);
	return `${projectPart}_${formatExportDate(exportedAt)}.zip`;
}

function sortImages(images: StoredImage[]) {
	return [...images].sort(
		(a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
	);
}

function imageFilenameForExport(project: Project, item: Item, image: StoredImage) {
	const itemIdentifier = item.itemNumber || `item-${item.id.slice(0, 8)}`;
	return generateImageFilename(project.name, itemIdentifier, image.sortOrder, image.mimeType);
}

export function imageMetadataForExport(
	project: Project,
	item: Item,
	image: StoredImage
): ExportImageMetadata {
	return {
		id: image.id,
		projectId: image.projectId,
		itemId: image.itemId,
		filename: imageFilenameForExport(project, item, image),
		mimeType: image.mimeType,
		size: image.size,
		createdAt: image.createdAt,
		sortOrder: image.sortOrder
	};
}

export function createProjectExportData(
	project: Project,
	items: Item[],
	imageGroups: Map<string, StoredImage[]>,
	exportedAt = nowIso()
): ProjectExportData {
	const imageEntries: ZipImageEntry[] = [];
	const csvRecords: ItemCsvRecord[] = [];
	const metadataItems: ExportItemMetadata[] = items.map((item) => {
		const images = sortImages(imageGroups.get(item.id) ?? []);
		const imageMetadata = images.map((image) => {
			const metadata = imageMetadataForExport(project, item, image);

			imageEntries.push({
				imageId: image.id,
				itemId: item.id,
				filename: metadata.filename,
				blob: image.blob
			});

			return metadata;
		});

		csvRecords.push({ item, images: imageMetadata });
		return { ...item, images: imageMetadata };
	});
	const metadata: ProjectExportMetadata = {
		project,
		exportedAt,
		itemCount: metadataItems.length,
		imageCount: imageEntries.length,
		items: metadataItems
	};
	const csv = generateItemsCsv(csvRecords);
	const json = `${JSON.stringify(metadata, null, 2)}\n`;

	return {
		filename: generateProjectZipFilename(project.name, exportedAt),
		metadata,
		csv,
		json,
		imageEntries
	};
}

export async function getProjectExportData(
	projectId: string,
	database: FurnitureSurveyDatabase = defaultDb,
	exportedAt = nowIso()
) {
	const project = await database.projects.get(projectId);

	if (!project) {
		throw new Error('Project not found');
	}

	const items = await getSavedItems(project.id, database);
	const imageGroups = await getImagesForItems(
		items.map((item) => item.id),
		database
	);

	return createProjectExportData(project, items, imageGroups, exportedAt);
}

export async function createProjectZipBlob(exportData: ProjectExportData) {
	const zip = new JSZip();
	const imageFolder = zip.folder('images');

	zip.file('items.csv', exportData.csv);
	zip.file('items.json', exportData.json);

	for (const image of exportData.imageEntries) {
		imageFolder?.file(image.filename, await image.blob.arrayBuffer());
	}

	return zip.generateAsync({
		type: 'blob',
		mimeType: 'application/zip',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});
}

export async function createProjectZip(
	projectId: string,
	database: FurnitureSurveyDatabase = defaultDb,
	exportedAt = nowIso()
): Promise<ProjectZipExport> {
	const exportData = await getProjectExportData(projectId, database, exportedAt);
	const blob = await createProjectZipBlob(exportData);

	return { ...exportData, blob };
}

export async function markProjectAsExported(
	projectId: string,
	input: MarkProjectExportedInput,
	database: FurnitureSurveyDatabase = defaultDb
) {
	if (!Number.isInteger(input.itemCount) || input.itemCount < 0) {
		throw new Error('Exported item count must be a non-negative integer');
	}

	const exportedAt = input.exportedAt ?? nowIso();
	const updated = await database.projects.update(projectId, {
		lastExportedAt: exportedAt,
		itemCountAtLastExport: input.itemCount,
		updatedAt: exportedAt
	});

	if (updated === 0) {
		throw new Error('Project not found');
	}

	const project = await database.projects.get(projectId);

	if (!project) {
		throw new Error('Project not found');
	}

	return project;
}

export function downloadBlob(blob: Blob, filename: string) {
	if (typeof document === 'undefined') {
		throw new Error('Downloads are only available in the browser');
	}

	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = filename;
	link.rel = 'noopener';
	document.body.append(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canShareZipFiles() {
	if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
	if (typeof File === 'undefined') return false;
	if (typeof navigator.canShare !== 'function') return true;

	try {
		const file = new File([''], 'furniture-survey.zip', { type: 'application/zip' });
		return navigator.canShare({ files: [file] });
	} catch {
		return false;
	}
}

export async function shareZipBlob(
	blob: Blob,
	filename: string,
	title = 'Furniture Survey export'
) {
	if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
		throw new Error('Sharing is not available in this browser');
	}

	if (typeof File === 'undefined') {
		throw new Error('File sharing is not available in this browser');
	}

	const file = new File([blob], filename, { type: blob.type || 'application/zip' });
	const shareData: ShareData = { title, files: [file] };

	if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
		throw new Error('This browser cannot share ZIP files');
	}

	await navigator.share(shareData);
}
