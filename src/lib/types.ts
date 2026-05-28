export type DimensionUnit = 'mm' | 'cm' | 'm';
export type ItemStatus = 'draft' | 'saved';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Project {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	nextItemSequence: number;
	lastRoom: string | null;
	lastDimensionUnit: DimensionUnit;
	lastExportedAt: string | null;
	itemCountAtLastExport: number;
}

export interface AppSettings {
	passcodeEnabled: boolean;
	passcodeHash: string | null;
	theme: ThemePreference;
}

export interface Item {
	id: string;
	projectId: string;
	itemNumber: string;
	itemName: string;
	room: string;
	quantity: number;
	length: number | null;
	width: number | null;
	height: number | null;
	dimensionUnit: DimensionUnit;
	notes: string;
	status: ItemStatus;
	createdAt: string;
	updatedAt: string;
}

export interface StoredImage {
	id: string;
	projectId: string;
	itemId: string;
	blob: Blob;
	filename: string;
	mimeType: string;
	size: number;
	createdAt: string;
	sortOrder: number;
}

export interface SettingsRecord<T = unknown> {
	key: string;
	value: T;
	updatedAt: string;
}
