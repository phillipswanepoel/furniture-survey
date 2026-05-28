import { describe, expect, it } from 'vitest';
import { getBackupReminder, hasUnexportedChanges } from './backupReminders';
import type { Project } from './types';

const project: Project = {
	id: 'project-1',
	name: 'Flat',
	createdAt: '2026-05-28T10:00:00.000Z',
	updatedAt: '2026-05-28T10:00:00.000Z',
	nextItemSequence: 1,
	lastRoom: null,
	lastDimensionUnit: 'mm',
	lastExportedAt: null,
	itemCountAtLastExport: 0
};

describe('backup reminders', () => {
	it('does not remind before there are saved items', () => {
		expect(getBackupReminder(project, 0)).toBeNull();
	});

	it('reminds when a project has never been exported', () => {
		expect(getBackupReminder(project, 2)).toMatchObject({
			reason: 'never-exported',
			itemsSinceExport: 2
		});
	});

	it('reminds after ten saved items since last export', () => {
		const exportedProject = {
			...project,
			updatedAt: '2026-05-28T11:00:00.000Z',
			lastExportedAt: '2026-05-28T11:00:00.000Z',
			itemCountAtLastExport: 5
		};

		expect(getBackupReminder(exportedProject, 15)).toMatchObject({
			reason: 'interval',
			itemsSinceExport: 10
		});
	});

	it('detects unexported edits even when item count is unchanged', () => {
		const editedProject = {
			...project,
			updatedAt: '2026-05-28T12:00:00.000Z',
			lastExportedAt: '2026-05-28T11:00:00.000Z',
			itemCountAtLastExport: 3
		};

		expect(hasUnexportedChanges(editedProject, 3)).toBe(true);
		expect(getBackupReminder(editedProject, 3)).toMatchObject({
			reason: 'unexported-changes'
		});
	});
});
