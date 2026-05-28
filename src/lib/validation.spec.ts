import { describe, expect, it } from 'vitest';
import { normalizeItemText, validateItemForSave } from './validation';

describe('item validation', () => {
	it('normalizes item text without changing meaningful words', () => {
		expect(normalizeItemText('  Oak   Dining   Chair  ')).toBe('Oak Dining Chair');
	});

	it('accepts a complete item with optional dimensions left blank', () => {
		const result = validateItemForSave({
			itemName: 'Chair',
			room: 'Dining Room',
			quantity: 1,
			length: null,
			width: null,
			height: null,
			dimensionUnit: 'mm'
		});

		expect(result).toStrictEqual({ valid: true, errors: {} });
	});

	it('requires item name, room, and a positive whole quantity', () => {
		const result = validateItemForSave({
			itemName: '   ',
			room: '',
			quantity: 0,
			length: null,
			width: null,
			height: null,
			dimensionUnit: 'mm'
		});

		expect(result.valid).toBe(false);
		expect(result.errors).toMatchObject({
			itemName: 'Item name is required',
			room: 'Room is required',
			quantity: 'Quantity must be at least 1'
		});
	});

	it('rejects invalid optional dimensions', () => {
		const result = validateItemForSave({
			itemName: 'Desk',
			room: 'Office',
			quantity: 1,
			length: -1,
			width: Number.NaN,
			height: null,
			dimensionUnit: 'cm'
		});

		expect(result.valid).toBe(false);
		expect(result.errors.length).toBe('Length cannot be negative');
		expect(result.errors.width).toBe('Enter a valid width or leave blank');
	});
});
