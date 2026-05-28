import { describe, expect, it } from 'vitest';
import {
	fileExtensionForMimeType,
	filenameSafePart,
	formatPhotoSortOrder,
	generateImageFilename
} from './filenames';

describe('filename helpers', () => {
	it('sanitizes filename parts for project image names', () => {
		expect(filenameSafePart('  24 High Street & Annex  ', 'project', true)).toBe(
			'24-high-street-and-annex'
		);
	});

	it('formats photo sort orders and image filenames', () => {
		expect(formatPhotoSortOrder(3)).toBe('03');
		expect(generateImageFilename('Flat 9', 'LR-001', 2, 'image/jpeg')).toBe('flat-9_LR-001_02.jpg');
		expect(fileExtensionForMimeType('image/webp')).toBe('webp');
	});
});
