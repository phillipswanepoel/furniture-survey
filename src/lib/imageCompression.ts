import imageCompression, {
	type Options as BrowserImageCompressionOptions
} from 'browser-image-compression';

export const DEFAULT_IMAGE_COMPRESSION_OPTIONS: BrowserImageCompressionOptions = {
	maxSizeMB: 1.2,
	maxWidthOrHeight: 1800,
	initialQuality: 0.8,
	useWebWorker: false,
	fileType: 'image/jpeg'
};

export type ImageCompressionOptions = BrowserImageCompressionOptions;

export async function compressImageFile(
	file: File,
	options: ImageCompressionOptions = DEFAULT_IMAGE_COMPRESSION_OPTIONS
) {
	if (file.type && !file.type.startsWith('image/')) {
		throw new Error('Choose an image file');
	}

	return imageCompression(file, { ...DEFAULT_IMAGE_COMPRESSION_OPTIONS, ...options });
}
