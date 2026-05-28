import { DEFAULT_APP_SETTINGS, SETTINGS_KEY, db as defaultDb } from './db';
import type { FurnitureSurveyDatabase } from './db';
import type { AppSettings, DimensionUnit, Project, SettingsRecord } from './types';

export interface CreateProjectInput {
	name: string;
}

export interface UpdateProjectInput {
	name?: string;
	lastRoom?: string | null;
	lastDimensionUnit?: DimensionUnit;
	lastExportedAt?: string | null;
	itemCountAtLastExport?: number;
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

export function normalizeProjectName(name: string) {
	return name.trim().replace(/\s+/g, ' ');
}

export function createProjectModel(input: CreateProjectInput, createdAt = nowIso()): Project {
	const name = normalizeProjectName(input.name);

	if (!name) {
		throw new Error('Project name is required');
	}

	return {
		id: createId(),
		name,
		createdAt,
		updatedAt: createdAt,
		nextItemSequence: 1,
		lastRoom: null,
		lastDimensionUnit: 'mm',
		lastExportedAt: null,
		itemCountAtLastExport: 0
	};
}

export async function createProject(
	input: CreateProjectInput,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const project = createProjectModel(input);
	await database.projects.add(project);
	return project;
}

export async function getProjects(database: FurnitureSurveyDatabase = defaultDb) {
	return database.projects.orderBy('updatedAt').reverse().toArray();
}

export async function getProject(id: string, database: FurnitureSurveyDatabase = defaultDb) {
	return database.projects.get(id);
}

export async function updateProject(
	id: string,
	input: UpdateProjectInput,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const changes: Partial<Project> = { updatedAt: nowIso() };

	if (input.name !== undefined) {
		const name = normalizeProjectName(input.name);

		if (!name) {
			throw new Error('Project name is required');
		}

		changes.name = name;
	}

	if (input.lastRoom !== undefined) changes.lastRoom = input.lastRoom;
	if (input.lastDimensionUnit !== undefined) changes.lastDimensionUnit = input.lastDimensionUnit;
	if (input.lastExportedAt !== undefined) changes.lastExportedAt = input.lastExportedAt;
	if (input.itemCountAtLastExport !== undefined) {
		changes.itemCountAtLastExport = input.itemCountAtLastExport;
	}

	const updated = await database.projects.update(id, changes);
	return updated > 0;
}

export async function deleteProject(id: string, database: FurnitureSurveyDatabase = defaultDb) {
	await database.transaction('rw', database.projects, database.items, database.images, async () => {
		await database.images.where('projectId').equals(id).delete();
		await database.items.where('projectId').equals(id).delete();
		await database.projects.delete(id);
	});
}

export async function countProjectItems(id: string, database: FurnitureSurveyDatabase = defaultDb) {
	return database.items.where('projectId').equals(id).count();
}

export async function getAppSettings(database: FurnitureSurveyDatabase = defaultDb) {
	const record = (await database.settings.get(SETTINGS_KEY)) as
		| SettingsRecord<AppSettings>
		| undefined;

	return record?.value ?? { ...DEFAULT_APP_SETTINGS };
}

export async function saveAppSettings(
	settings: AppSettings,
	database: FurnitureSurveyDatabase = defaultDb
) {
	const record: SettingsRecord<AppSettings> = {
		key: SETTINGS_KEY,
		value: settings,
		updatedAt: nowIso()
	};

	await database.settings.put(record);
	return settings;
}
