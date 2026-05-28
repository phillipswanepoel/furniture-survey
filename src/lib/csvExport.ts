import type { Item } from './types';

export const ITEM_CSV_COLUMNS = [
	'item_number',
	'item_name',
	'room',
	'quantity',
	'length',
	'width',
	'height',
	'unit',
	'notes',
	'image_filenames',
	'created_at',
	'updated_at'
] as const;

export type ItemCsvColumn = (typeof ITEM_CSV_COLUMNS)[number];

export interface ItemCsvImage {
	filename: string;
}

export interface ItemCsvRecord {
	item: Item;
	images: ItemCsvImage[];
}

type CsvCellValue = string | number | null | undefined;

export function escapeCsvCell(value: CsvCellValue) {
	const text = value === null || value === undefined ? '' : String(value);

	if (!/[",\r\n]/.test(text)) return text;

	return `"${text.replace(/"/g, '""')}"`;
}

function dimensionValue(value: number | null) {
	return value === null ? '' : value;
}

export function itemCsvValues(record: ItemCsvRecord): CsvCellValue[] {
	const { item, images } = record;

	return [
		item.itemNumber,
		item.itemName,
		item.room,
		item.quantity,
		dimensionValue(item.length),
		dimensionValue(item.width),
		dimensionValue(item.height),
		item.dimensionUnit,
		item.notes,
		images.map((image) => image.filename).join(';'),
		item.createdAt,
		item.updatedAt
	];
}

export function generateItemsCsv(records: ItemCsvRecord[]) {
	const rows = [ITEM_CSV_COLUMNS, ...records.map(itemCsvValues)];
	return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}
