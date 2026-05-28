export const ROOM_CODES = {
	'living room': 'LR',
	lounge: 'LR',
	bedroom: 'BR',
	'master bedroom': 'MBR',
	kitchen: 'KIT',
	'dining room': 'DR',
	office: 'OFF',
	bathroom: 'BATH',
	hallway: 'HALL',
	storage: 'STOR'
} as const;

export type RoomCodeDictionary = Record<string, string>;

export function normalizeRoomName(room: string) {
	return room.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getKnownRoomCode(room: string, roomCodes: RoomCodeDictionary = ROOM_CODES) {
	const normalizedRoom = normalizeRoomName(room);
	return roomCodes[normalizedRoom] ?? null;
}

export function createFallbackRoomCode(room: string) {
	const words = normalizeRoomName(room)
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ')
		.filter(Boolean);

	if (words.length === 0) return 'RM';

	if (words.length === 1) {
		return words[0].slice(0, 3).toUpperCase() || 'RM';
	}

	return words
		.slice(0, 4)
		.map((word) => word[0])
		.join('')
		.toUpperCase();
}

export function getRoomCode(room: string, roomCodes: RoomCodeDictionary = ROOM_CODES) {
	return getKnownRoomCode(room, roomCodes) ?? createFallbackRoomCode(room);
}
