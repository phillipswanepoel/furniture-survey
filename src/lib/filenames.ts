export function filenameSafePart(value: string, fallback: string, lowerCase = false) {
	const normalized = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.replace(/&/g, ' and ')
		.replace(/[^a-zA-Z0-9-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');

	const safeValue = normalized || fallback;
	return lowerCase ? safeValue.toLowerCase() : safeValue;
}

export function fileExtensionForMimeType(mimeType: string) {
	const normalized = mimeType.toLowerCase();

	if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
	if (normalized === 'image/png') return 'png';
	if (normalized === 'image/webp') return 'webp';
	if (normalized === 'image/gif') return 'gif';
	if (normalized === 'image/heic') return 'heic';
	if (normalized === 'image/heif') return 'heif';

	return 'jpg';
}

export function formatPhotoSortOrder(sortOrder: number) {
	if (!Number.isInteger(sortOrder) || sortOrder < 1) {
		throw new Error('Photo sort order must be a positive integer');
	}

	return sortOrder.toString().padStart(2, '0');
}

export function generateImageFilename(
	projectName: string,
	itemIdentifier: string,
	sortOrder: number,
	mimeType: string
) {
	const projectPart = filenameSafePart(projectName, 'project', true);
	const itemPart = filenameSafePart(itemIdentifier, 'item');
	const photoPart = formatPhotoSortOrder(sortOrder);
	const extension = fileExtensionForMimeType(mimeType);

	return `${projectPart}_${itemPart}_${photoPart}.${extension}`;
}
