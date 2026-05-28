import { expect, test } from '@playwright/test';

test('complete local survey flow', async ({ page }) => {
	page.on('dialog', (dialog) => dialog.accept());

	await page.goto('/');
	await page.getByLabel('Name').fill('24 High Street');
	await page.getByRole('button', { name: 'Create' }).click();
	await page.getByRole('link', { name: 'Open' }).click();

	await expect(page.getByRole('heading', { name: '24 High Street' })).toBeVisible();
	await page.getByRole('link', { name: 'Continue survey' }).click();

	await expect(page.getByRole('button', { name: 'Save item' })).toBeDisabled();
	await page.getByLabel('Item name').fill('Oak chair');
	await page.getByLabel('Room').fill('Living Room');
	await expect(page.getByText('LR-001')).toBeVisible();
	await page.getByRole('button', { name: 'Save + next' }).click();

	await expect(page.getByText('Saved LR-001. Ready for the next item.')).toBeVisible();
	await expect(page.getByLabel('Room')).toHaveValue('Living Room');
	await expect(page.getByLabel('Quantity')).toHaveValue('1');

	await page.getByLabel('Item name').fill('Kitchen table');
	await page.getByLabel('Room').fill('Kitchen');
	await page.getByRole('button', { name: 'Save item' }).click();

	await expect(page.getByRole('heading', { name: 'Items review' })).toBeVisible();
	await expect(page.getByText('LR-001')).toBeVisible();
	await expect(page.getByText('KIT-002')).toBeVisible();

	await page.getByRole('searchbox', { name: 'Search' }).fill('chair');
	await expect(page.getByText('Oak chair')).toBeVisible();
	await expect(page.getByText('Kitchen table')).toBeHidden();
	await page.getByRole('searchbox', { name: 'Search' }).fill('');
	await page.locator('#room-filter').selectOption('Kitchen');
	await expect(page.getByText('Kitchen table')).toBeVisible();
	await expect(page.getByText('Oak chair')).toBeHidden();
	await page.locator('#room-filter').selectOption('');

	const tableCard = page.locator('.item-card').filter({ hasText: 'KIT-002' });
	await tableCard.getByText('Edit item').click();
	await tableCard.getByLabel('Item name').fill('Round kitchen table');
	await tableCard.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByText('Updated KIT-002.')).toBeVisible();
	await expect(page.getByText('Round kitchen table')).toBeVisible();

	await page.getByRole('link', { name: '← Project' }).click();
	await expect(page.getByText('Backup reminder')).toBeVisible();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export ZIP' }).click();
	const download = await downloadPromise;
	await expect(download.suggestedFilename()).toMatch(/24-high-street_\d{4}-\d{2}-\d{2}\.zip/);

	await page.getByRole('link', { name: 'Review items' }).click();
	const updatedTableCard = page.locator('.item-card').filter({ hasText: 'KIT-002' });
	await updatedTableCard.getByText('Edit item').click();
	await updatedTableCard.getByRole('button', { name: 'Delete item' }).click();
	await expect(page.getByText('Deleted KIT-002.')).toBeVisible();
	await expect(page.getByText('Round kitchen table')).toBeHidden();
});
