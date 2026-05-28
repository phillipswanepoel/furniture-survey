const HASH_VERSION = 'sha256';

function bytesToHex(bytes: Uint8Array) {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function timingSafeEqual(left: string, right: string) {
	if (left.length !== right.length) return false;

	let diff = 0;
	for (let index = 0; index < left.length; index += 1) {
		diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}

	return diff === 0;
}

async function digestHex(value: string) {
	if (typeof crypto === 'undefined' || !crypto.subtle) {
		throw new Error('Secure hashing is not available in this browser');
	}

	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', encoded);
	return bytesToHex(new Uint8Array(digest));
}

function createSalt() {
	const bytes = new Uint8Array(16);

	if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
		throw new Error('Secure random values are not available in this browser');
	}

	crypto.getRandomValues(bytes);
	return bytesToHex(bytes);
}

export function normalizePasscode(passcode: string) {
	return passcode.trim();
}

export function validatePasscode(passcode: string) {
	const normalized = normalizePasscode(passcode);

	if (normalized.length < 4) return 'Use at least 4 characters.';
	if (normalized.length > 128) return 'Use 128 characters or fewer.';

	return null;
}

export async function createPasscodeHash(passcode: string, salt = createSalt()) {
	const normalized = normalizePasscode(passcode);
	const validationError = validatePasscode(normalized);

	if (validationError) {
		throw new Error(validationError);
	}

	const hash = await digestHex(`${salt}:${normalized}`);
	return `${HASH_VERSION}:${salt}:${hash}`;
}

export async function checkPasscode(passcode: string, storedHash: string | null | undefined) {
	if (!storedHash) return false;

	const [version, salt, expectedHash] = storedHash.split(':');
	if (version !== HASH_VERSION || !salt || !expectedHash) return false;

	const hash = await digestHex(`${salt}:${normalizePasscode(passcode)}`);
	return timingSafeEqual(hash, expectedHash);
}
