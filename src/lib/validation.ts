import type { DimensionUnit } from './types';

export interface ItemValidationInput {
	itemName: string;
	room: string;
	quantity: number;
	length?: number | null;
	width?: number | null;
	height?: number | null;
	dimensionUnit: DimensionUnit;
}

export type ItemValidationField = keyof Pick<
	ItemValidationInput,
	'itemName' | 'room' | 'quantity' | 'length' | 'width' | 'height' | 'dimensionUnit'
>;

export type ItemValidationErrors = Partial<Record<ItemValidationField, string>>;

export interface ItemValidationResult {
	valid: boolean;
	errors: ItemValidationErrors;
}

export function normalizeItemText(value: string) {
	return value.trim().replace(/\s+/g, ' ');
}

function validateOptionalDimension(value: number | null | undefined, label: string) {
	if (value === null || value === undefined) return null;
	if (!Number.isFinite(value)) return `Enter a valid ${label.toLowerCase()} or leave blank`;
	if (value < 0) return `${label} cannot be negative`;
	return null;
}

export function validateItemForSave(input: ItemValidationInput): ItemValidationResult {
	const errors: ItemValidationErrors = {};

	if (!normalizeItemText(input.itemName)) {
		errors.itemName = 'Item name is required';
	}

	if (!normalizeItemText(input.room)) {
		errors.room = 'Room is required';
	}

	if (!Number.isFinite(input.quantity) || input.quantity < 1) {
		errors.quantity = 'Quantity must be at least 1';
	} else if (!Number.isInteger(input.quantity)) {
		errors.quantity = 'Quantity must be a whole number';
	}

	const lengthError = validateOptionalDimension(input.length, 'Length');
	if (lengthError) errors.length = lengthError;

	const widthError = validateOptionalDimension(input.width, 'Width');
	if (widthError) errors.width = widthError;

	const heightError = validateOptionalDimension(input.height, 'Height');
	if (heightError) errors.height = heightError;

	if (!['mm', 'cm', 'm'].includes(input.dimensionUnit)) {
		errors.dimensionUnit = 'Choose a valid unit';
	}

	return {
		valid: Object.keys(errors).length === 0,
		errors
	};
}
