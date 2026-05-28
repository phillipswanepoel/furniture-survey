import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { createItemsSpreadsheetBlob } from './spreadsheetExport';
import type { Item } from './types';

const ONE_PIXEL_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const item: Item = {
	id: 'item-1',
	projectId: 'project-1',
	itemNumber: 'LR-001',
	itemName: 'Oak chair',
	room: 'Living Room',
	quantity: 2,
	length: 100,
	width: null,
	height: 75.5,
	dimensionUnit: 'cm',
	notes: 'Wrap legs',
	status: 'saved',
	createdAt: '2026-05-28T10:00:00.000Z',
	updatedAt: '2026-05-28T10:30:00.000Z'
};

function pngBlob() {
	return new Blob([Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')], { type: 'image/png' });
}

describe('spreadsheet export', () => {
	it('generates XLSX columns with embedded image columns and no timestamp columns', async () => {
		const spreadsheet = await createItemsSpreadsheetBlob([
			{
				item,
				images: [
					{ filename: 'flat_LR-001_01.png', blob: pngBlob(), mimeType: 'image/png' },
					{ filename: 'flat_LR-001_02.png', blob: pngBlob(), mimeType: 'image/png' }
				]
			}
		]);
		const workbook = new ExcelJS.Workbook();

		const spreadsheetBuffer = Buffer.from(await spreadsheet.arrayBuffer());
		await workbook.xlsx.load(
			spreadsheetBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
		);

		const worksheet = workbook.getWorksheet('Items');
		const headers = worksheet?.getRow(1).values;

		expect(worksheet).toBeDefined();
		expect(headers).toContain('image_1');
		expect(headers).toContain('image_2');
		expect(headers).not.toContain('image_filenames');
		expect(headers).not.toContain('created_at');
		expect(headers).not.toContain('updated_at');
		expect(worksheet?.getCell('A2').value).toBe('LR-001');
		expect(worksheet?.getCell('B2').value).toBe('Oak chair');
		expect(worksheet?.getImages()).toHaveLength(2);
	});
});
