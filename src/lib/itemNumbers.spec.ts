import { describe, expect, it } from 'vitest';
import { formatItemSequence, generateItemNumber } from './itemNumbers';

describe('item numbers', () => {
	it('formats item sequences with three-digit padding', () => {
		expect(formatItemSequence(1)).toBe('001');
		expect(formatItemSequence(42)).toBe('042');
		expect(formatItemSequence(1000)).toBe('1000');
	});

	it('combines room code and global project sequence', () => {
		expect(generateItemNumber('Living Room', 1)).toBe('LR-001');
		expect(generateItemNumber('Bedroom', 3)).toBe('BR-003');
		expect(generateItemNumber('Sun Room', 4)).toBe('SR-004');
	});

	it('rejects invalid sequences', () => {
		expect(() => formatItemSequence(0)).toThrow('Item sequence must be a positive integer');
		expect(() => formatItemSequence(1.5)).toThrow('Item sequence must be a positive integer');
	});
});
