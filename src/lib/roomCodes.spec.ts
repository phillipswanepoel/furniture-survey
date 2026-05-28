import { describe, expect, it } from 'vitest';
import {
	createFallbackRoomCode,
	getKnownRoomCode,
	getRoomCode,
	normalizeRoomName
} from './roomCodes';

describe('room codes', () => {
	it('normalizes room names for dictionary lookup', () => {
		expect(normalizeRoomName('  Living   Room  ')).toBe('living room');
		expect(getKnownRoomCode('  MASTER   Bedroom ')).toBe('MBR');
	});

	it('returns configured aliases for common rooms', () => {
		expect(getRoomCode('Lounge')).toBe('LR');
		expect(getRoomCode('Kitchen')).toBe('KIT');
	});

	it('creates fallback room codes from unknown room text', () => {
		expect(createFallbackRoomCode('Sun Room')).toBe('SR');
		expect(createFallbackRoomCode('Loft')).toBe('LOF');
		expect(createFallbackRoomCode('')).toBe('RM');
	});
});
