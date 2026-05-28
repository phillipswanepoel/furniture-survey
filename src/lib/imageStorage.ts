import { db as defaultDb, type FurnitureSurveyDatabase } from './db';
import { generateImageFilename } from './filenames';
import { compressImageFile, type ImageCompressionOptions } from './imageCompression';
import type { Item, Project, StoredImage } from './types';

export interface AddImageOptions {
	createdAt?: string;
	mimeType?: string;
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

function sortImages(images: StoredImage[]) {
	return [...images].sort(
		(a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
	);
}

function getImageItemIdentifier(item: Item) {
	return item.itemNumber || `draft-${item.id.slice(0, 8)}`;
}

function createImageFilename(project: Project, item: Item, sortOrder: number, mimeType: string) {
	return generateImageFilename(project.name, getImageItemIdentifier(item), sortOrder, mimeType);
}

export async function getImagesForItem(
	itemId: string,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const images = await database.images.where('itemId').equals(itemId).toArray();
	return sortImages(images);
}

export async function getImagesForItems(
	itemIds: string[],
	database: FurnitureSurveyDatabase = defaultDb
) {
	const groups = new Map<string, StoredImage[]>(itemIds.map((itemId) => [itemId, []]));

	if (itemIds.length === 0) return groups;

	const images = await database.images.where('itemId').anyOf(itemIds).toArray();

	for (const image of sortImages(images)) {
		const group = groups.get(image.itemId) ?? [];
		group.push(image);
		groups.set(image.itemId, group);
	}

	return groups;
}

export async function countItemImages(
	itemId: string,
	database: FurnitureSurveyDatabase = defaultDb
) {
	return database.images.where('itemId').equals(itemId).count();
}

export async function updateImageFilenamesForItem(
	item: Item,
	project: Project,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const images = await getImagesForItem(item.id, database);

	await Promise.all(
		images.map((image, index) => {
			const sortOrder = index + 1;
			return database.images.update(image.id, {
				sortOrder,
				filename: createImageFilename(project, item, sortOrder, image.mimeType)
			});
		})
	);
}

export async function addImageToItem(
	itemId: string,
	blob: Blob,
	database: FurnitureSurveyDatabase = defaultDb,
	options: AddImageOptions = {}
) {
	return database.transaction(
		'rw',
		database.projects,
		database.items,
		database.images,
		async () => {
			const item = await database.items.get(itemId);

			if (!item) {
				throw new Error('Item not found');
			}

			const project = await database.projects.get(item.projectId);

			if (!project) {
				throw new Error('Project not found');
			}

			const existingImages = await getImagesForItem(item.id, database);
			const sortOrder = Math.max(0, ...existingImages.map((image) => image.sortOrder)) + 1;
			const mimeType = options.mimeType || blob.type || 'image/jpeg';
			const createdAt = options.createdAt ?? nowIso();
			const image: StoredImage = {
				id: createId(),
				projectId: item.projectId,
				itemId: item.id,
				blob,
				filename: createImageFilename(project, item, sortOrder, mimeType),
				mimeType,
				size: blob.size,
				createdAt,
				sortOrder
			};
			const timestamp = nowIso();

			await database.images.add(image);
			await database.items.update(item.id, { updatedAt: timestamp });
			await database.projects.update(project.id, { updatedAt: timestamp });

			return image;
		}
	);
}

export async function compressAndAddImageToItem(
	itemId: string,
	file: File,
	database: FurnitureSurveyDatabase = defaultDb,
	compressionOptions?: ImageCompressionOptions
) {
	const compressedImage = await compressImageFile(file, compressionOptions);
	return addImageToItem(itemId, compressedImage, database, { mimeType: compressedImage.type });
}

export async function deleteImage(id: string, database: FurnitureSurveyDatabase = defaultDb) {
	return database.transaction(
		'rw',
		database.projects,
		database.items,
		database.images,
		async () => {
			const image = await database.images.get(id);

			if (!image) return false;

			await database.images.delete(id);

			const item = await database.items.get(image.itemId);
			if (!item) return true;

			const project = await database.projects.get(item.projectId);
			if (!project) return true;

			const timestamp = nowIso();
			const updatedItem: Item = { ...item, updatedAt: timestamp };
			const updatedProject: Project = { ...project, updatedAt: timestamp };

			await database.items.update(item.id, { updatedAt: timestamp });
			await database.projects.update(project.id, { updatedAt: timestamp });
			await updateImageFilenamesForItem(updatedItem, updatedProject, database);

			return true;
		}
	);
}
