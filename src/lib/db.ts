import Dexie, { type Table } from 'dexie';
import type { Item, Project, SettingsRecord, StoredImage } from './types';

export const DATABASE_NAME = 'furniture-survey';

type DexieConstructorOptions = ConstructorParameters<typeof Dexie>[1];

export class FurnitureSurveyDatabase extends Dexie {
	projects!: Table<Project, string>;
	items!: Table<Item, string>;
	images!: Table<StoredImage, string>;
	settings!: Table<SettingsRecord, string>;

	constructor(name = DATABASE_NAME, options?: DexieConstructorOptions) {
		super(name, options);

		this.version(1).stores({
			projects: 'id, name, updatedAt',
			items: 'id, projectId, itemNumber, room, itemName, status, updatedAt',
			images: 'id, projectId, itemId, sortOrder, createdAt',
			settings: 'key'
		});
	}
}

export function createDatabase(name = DATABASE_NAME, options?: DexieConstructorOptions) {
	return new FurnitureSurveyDatabase(name, options);
}

export const db = createDatabase();
