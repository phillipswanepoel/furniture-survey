import type { Project } from './types';

export type BackupReminderReason = 'never-exported' | 'interval' | 'unexported-changes';

export interface BackupReminder {
	reason: BackupReminderReason;
	message: string;
	itemsSinceExport: number;
}

export const BACKUP_REMINDER_ITEM_INTERVAL = 10;

export function getItemsSinceLastExport(project: Project, savedItemCount: number) {
	return Math.max(0, savedItemCount - project.itemCountAtLastExport);
}

export function hasUnexportedChanges(project: Project, savedItemCount: number) {
	if (savedItemCount !== project.itemCountAtLastExport) return true;
	if (!project.lastExportedAt) return savedItemCount > 0;

	return project.updatedAt > project.lastExportedAt;
}

export function getBackupReminder(project: Project, savedItemCount: number): BackupReminder | null {
	if (savedItemCount <= 0) return null;

	const itemsSinceExport = getItemsSinceLastExport(project, savedItemCount);

	if (!project.lastExportedAt) {
		return {
			reason: 'never-exported',
			message: 'This project has not been exported yet. Export a ZIP backup before leaving site.',
			itemsSinceExport
		};
	}

	if (itemsSinceExport >= BACKUP_REMINDER_ITEM_INTERVAL) {
		return {
			reason: 'interval',
			message: `${itemsSinceExport} new items since the last export. Create a fresh ZIP backup.`,
			itemsSinceExport
		};
	}

	if (hasUnexportedChanges(project, savedItemCount)) {
		return {
			reason: 'unexported-changes',
			message: 'This project has changes that are not in the latest ZIP export.',
			itemsSinceExport
		};
	}

	return null;
}
