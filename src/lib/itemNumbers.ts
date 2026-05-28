import { getRoomCode, type RoomCodeDictionary } from './roomCodes';

export function formatItemSequence(sequence: number) {
	if (!Number.isInteger(sequence) || sequence < 1) {
		throw new Error('Item sequence must be a positive integer');
	}

	return sequence.toString().padStart(3, '0');
}

export function generateItemNumber(room: string, sequence: number, roomCodes?: RoomCodeDictionary) {
	return `${getRoomCode(room, roomCodes)}-${formatItemSequence(sequence)}`;
}
