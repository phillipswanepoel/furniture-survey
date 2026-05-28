import { describe, expect, it } from 'vitest';
import { checkPasscode, createPasscodeHash, validatePasscode } from './passcode';

describe('passcode helpers', () => {
	it('validates minimum passcode length', () => {
		expect(validatePasscode('123')).toBe('Use at least 4 characters.');
		expect(validatePasscode('1234')).toBeNull();
	});

	it('hashes and checks passcodes with a salt', async () => {
		const hash = await createPasscodeHash(' 1234 ', 'fixed-salt');

		expect(hash).toMatch(/^sha256:fixed-salt:/);
		expect(await checkPasscode('1234', hash)).toBe(true);
		expect(await checkPasscode('0000', hash)).toBe(false);
		expect(await checkPasscode('1234', null)).toBe(false);
	});
});
