import { describe, expect, it } from 'vitest';
import { escapeCsvCell, generateItemsCsv, ITEM_CSV_COLUMNS } from './csvExport';
import type { Item } from './types';

const item: Item = {
	id: 'item-1',
	projectId: 'project-1',
	itemNumber: 'LR-001',
	itemName: 'Oak, chair',
	room: 'Living Room',
	quantity: 2,
	length: 100,
	width: null,
	height: 75.5,
	dimensionUnit: 'cm',
	notes: 'Needs "care"\nWrap legs',
	status: 'saved',
	createdAt: '2026-05-28T10:00:00.000Z',
	updatedAt: '2026-05-28T10:30:00.000Z'
};

describe('CSV export', () => {
	it('escapes CSV cells with commas, quotes, and newlines', () => {
		expect(escapeCsvCell('Chair, "large"\nred')).toBe('"Chair, ""large""\nred"');
		expect(escapeCsvCell(null)).toBe('');
	});

	it('generates the item CSV with export columns and image filenames', () => {
		const csv = generateItemsCsv([
			{
				item,
				images: [{ filename: 'flat_LR-001_01.jpg' }, { filename: 'flat_LR-001_02.jpg' }]
			}
		]);

		expect(csv).toBe(
			[
				ITEM_CSV_COLUMNS.join(','),
				'LR-001,"Oak, chair",Living Room,2,100,,75.5,cm,"Needs ""care""\nWrap legs",flat_LR-001_01.jpg;flat_LR-001_02.jpg,2026-05-28T10:00:00.000Z,2026-05-28T10:30:00.000Z'
			].join('\n') + '\n'
		);
	});
});
