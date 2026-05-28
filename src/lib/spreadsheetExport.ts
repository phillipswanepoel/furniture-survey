import ExcelJS from 'exceljs';
import type { Image } from 'exceljs';
import type { Item } from './types';

export const SPREADSHEET_IMAGE_MAX_SIZE = 500;
const SPREADSHEET_IMAGE_QUALITY = 0.85;
const IMAGE_PADDING_PIXELS = 8;
const POINTS_PER_PIXEL = 0.75;
const APPROX_PIXELS_PER_EXCEL_WIDTH_UNIT = 7;

type SpreadsheetImageExtension = Image['extension'];

export interface SpreadsheetImageRecord {
	filename: string;
	blob: Blob;
	mimeType?: string;
}

export interface SpreadsheetItemRecord {
	item: Item;
	images: SpreadsheetImageRecord[];
}

export interface SpreadsheetExportOptions {
	maxImageSize?: number;
	imageQuality?: number;
}

interface PreparedSpreadsheetImage {
	base64: string;
	extension: SpreadsheetImageExtension;
	width: number;
	height: number;
}

interface LoadedImageSource {
	source: CanvasImageSource;
	width: number;
	height: number;
	close?: () => void;
}

const BASE_SPREADSHEET_COLUMNS = [
	{ header: 'item_number', key: 'itemNumber', width: 16 },
	{ header: 'item_name', key: 'itemName', width: 24 },
	{ header: 'room', key: 'room', width: 20 },
	{ header: 'quantity', key: 'quantity', width: 10 },
	{ header: 'length', key: 'length', width: 10 },
	{ header: 'width', key: 'width', width: 10 },
	{ header: 'height', key: 'height', width: 10 },
	{ header: 'unit', key: 'dimensionUnit', width: 8 },
	{ header: 'notes', key: 'notes', width: 36 }
] as const;

function dimensionValue(value: number | null) {
	return value === null ? '' : value;
}

function pixelsToExcelColumnWidth(pixels: number) {
	return Math.ceil(pixels / APPROX_PIXELS_PER_EXCEL_WIDTH_UNIT);
}

function pixelsToPoints(pixels: number) {
	return pixels * POINTS_PER_PIXEL;
}

function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number) {
	if (width <= 0 || height <= 0) {
		return { width: maxWidth, height: maxHeight };
	}

	const scale = Math.min(1, maxWidth / width, maxHeight / height);

	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

function imageExtensionFromMimeType(
	mimeType: string | undefined
): SpreadsheetImageExtension | null {
	const normalized = mimeType?.toLowerCase().split(';')[0].trim();

	if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpeg';
	if (normalized === 'image/png') return 'png';
	if (normalized === 'image/gif') return 'gif';
	return null;
}

function imageExtensionFromFilename(filename: string): SpreadsheetImageExtension | null {
	const extension = filename.toLowerCase().split('.').pop();

	if (extension === 'jpg' || extension === 'jpeg') return 'jpeg';
	if (extension === 'png') return 'png';
	if (extension === 'gif') return 'gif';
	return null;
}

function imageMimeTypeForExtension(extension: SpreadsheetImageExtension) {
	return extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`;
}

function imageExtensionForRecord(image: SpreadsheetImageRecord): SpreadsheetImageExtension {
	return (
		imageExtensionFromMimeType(image.mimeType || image.blob.type) ??
		imageExtensionFromFilename(image.filename) ??
		'jpeg'
	);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
	const bytes = new Uint8Array(buffer);
	const chunkSize = 0x8000;
	let binary = '';

	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}

	if (typeof btoa === 'function') return btoa(binary);
	if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');

	throw new Error('Base64 encoding is not available in this environment');
}

async function blobToDataUrl(blob: Blob, mimeType: string) {
	const base64 = arrayBufferToBase64(await blob.arrayBuffer());
	return `data:${mimeType};base64,${base64}`;
}

function canUseCanvasImageResize() {
	return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

async function loadImageSource(blob: Blob): Promise<LoadedImageSource> {
	if (typeof createImageBitmap === 'function') {
		const bitmap = await createImageBitmap(blob);
		return {
			source: bitmap,
			width: bitmap.width,
			height: bitmap.height,
			close: () => bitmap.close()
		};
	}

	if (typeof Image === 'undefined' || typeof URL === 'undefined') {
		throw new Error('Image decoding is not available in this environment');
	}

	const url = URL.createObjectURL(blob);

	try {
		const image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const element = new Image();
			element.onload = () => resolve(element);
			element.onerror = () => reject(new Error('Could not decode spreadsheet image'));
			element.src = url;
		});

		return {
			source: image,
			width: image.naturalWidth || image.width,
			height: image.naturalHeight || image.height
		};
	} finally {
		URL.revokeObjectURL(url);
	}
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error('Could not render spreadsheet image'));
			},
			mimeType,
			quality
		);
	});
}

async function resizeImageForSpreadsheet(
	image: SpreadsheetImageRecord,
	maxImageSize: number,
	quality: number
): Promise<PreparedSpreadsheetImage | null> {
	if (!canUseCanvasImageResize()) return null;

	const loadedImage = await loadImageSource(image.blob);

	try {
		const size = fitWithin(loadedImage.width, loadedImage.height, maxImageSize, maxImageSize);
		const canvas = document.createElement('canvas');
		canvas.width = size.width;
		canvas.height = size.height;

		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas rendering is not available');

		context.drawImage(loadedImage.source, 0, 0, size.width, size.height);

		const resizedBlob = await canvasToBlob(canvas, 'image/jpeg', quality);

		return {
			base64: await blobToDataUrl(resizedBlob, 'image/jpeg'),
			extension: 'jpeg',
			...size
		};
	} finally {
		loadedImage.close?.();
	}
}

async function prepareSpreadsheetImage(
	image: SpreadsheetImageRecord,
	maxImageSize: number,
	quality: number
): Promise<PreparedSpreadsheetImage> {
	try {
		const resizedImage = await resizeImageForSpreadsheet(image, maxImageSize, quality);
		if (resizedImage) return resizedImage;
	} catch {
		// Fall back to the stored image if browser image decoding/resizing fails.
	}

	const extension = imageExtensionForRecord(image);
	const mimeType = image.mimeType || image.blob.type || imageMimeTypeForExtension(extension);

	return {
		base64: await blobToDataUrl(image.blob, mimeType),
		extension,
		width: maxImageSize,
		height: maxImageSize
	};
}

export async function createItemsSpreadsheetBlob(
	records: SpreadsheetItemRecord[],
	options: SpreadsheetExportOptions = {}
) {
	const maxImageSize = options.maxImageSize ?? SPREADSHEET_IMAGE_MAX_SIZE;
	const imageQuality = options.imageQuality ?? SPREADSHEET_IMAGE_QUALITY;
	const maxImageCount = Math.max(1, ...records.map((record) => record.images.length));
	const workbook = new ExcelJS.Workbook();

	workbook.creator = 'Furniture Survey';
	workbook.created = new Date();
	workbook.modified = new Date();

	const worksheet = workbook.addWorksheet('Items', {
		views: [{ state: 'frozen', ySplit: 1 }]
	});
	const imageColumnWidth = pixelsToExcelColumnWidth(maxImageSize + IMAGE_PADDING_PIXELS * 2);

	worksheet.columns = [
		...BASE_SPREADSHEET_COLUMNS,
		...Array.from({ length: maxImageCount }, (_, index) => ({
			header: `image_${index + 1}`,
			key: `image_${index + 1}`,
			width: imageColumnWidth
		}))
	];

	const headerRow = worksheet.getRow(1);
	headerRow.font = { bold: true };
	headerRow.alignment = { vertical: 'middle' };
	headerRow.height = 22;

	worksheet.autoFilter = {
		from: { row: 1, column: 1 },
		to: { row: 1, column: BASE_SPREADSHEET_COLUMNS.length + maxImageCount }
	};

	for (const record of records) {
		const { item } = record;
		const row = worksheet.addRow({
			itemNumber: item.itemNumber,
			itemName: item.itemName,
			room: item.room,
			quantity: item.quantity,
			length: dimensionValue(item.length),
			width: dimensionValue(item.width),
			height: dimensionValue(item.height),
			dimensionUnit: item.dimensionUnit,
			notes: item.notes
		});
		const preparedImages = await Promise.all(
			record.images.map((image) => prepareSpreadsheetImage(image, maxImageSize, imageQuality))
		);
		const tallestImage = Math.max(0, ...preparedImages.map((image) => image.height));

		row.alignment = { vertical: 'top', wrapText: true };
		if (tallestImage) {
			row.height = pixelsToPoints(tallestImage + IMAGE_PADDING_PIXELS * 2);
		}

		preparedImages.forEach((image, imageIndex) => {
			const imageId = workbook.addImage({
				base64: image.base64,
				extension: image.extension
			});
			const zeroBasedColumnIndex = BASE_SPREADSHEET_COLUMNS.length + imageIndex;
			const zeroBasedRowIndex = row.number - 1;

			worksheet.addImage(imageId, {
				tl: {
					col: zeroBasedColumnIndex + 0.05,
					row: zeroBasedRowIndex + 0.05
				},
				ext: {
					width: image.width,
					height: image.height
				}
			});
		});
	}

	const buffer = await workbook.xlsx.writeBuffer();

	return new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
}
