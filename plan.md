# Furniture Survey PWA Plan

## Direction

Build a mobile-first, local-first PWA for iPhone using SvelteKit. The app runs mostly in the browser, works offline after first load/install, stores projects/items/photos locally in IndexedDB, and exports each project as a ZIP containing CSV, JSON, and images.

Camera Roll saving is not part of the MVP. It can be revisited later with a hybrid/native wrapper if needed.

## Chosen tech stack

- **SvelteKit** static app
- **TypeScript**
- **Dexie** for IndexedDB
- **vite-plugin-pwa** for manifest/service worker/offline app shell
- **browser-image-compression** for medium image compression
- **JSZip** for ZIP export
- **Vitest** for unit/storage tests
- **fake-indexeddb** for IndexedDB tests
- **Playwright** for browser/e2e tests
- **Netlify/Vercel** static hosting
- Plain CSS/CSS variables for styling and light/dark mode

## Core features

- Create and manage multiple projects.
- Add furniture items quickly while surveying.
- Take/add multiple photos per item.
- Compress photos to medium quality before storing.
- Enter structured item details.
- Autosave drafts/photos to protect against data loss.
- Review, search, edit, and delete items.
- Export each project as a ZIP containing CSV, JSON, and images.
- App-wide passcode gate.
- Light/dark mode toggle.
- Backup reminders.

## Basic architecture

The app is a static SvelteKit PWA. There is no backend for the MVP.

```text
iPhone browser / installed PWA
  -> SvelteKit UI
  -> TypeScript domain/storage/export modules
  -> IndexedDB via Dexie
  -> Service worker/offline shell
  -> ZIP export downloaded/shared by user
```

Most business logic should live in small TypeScript modules under `src/lib`, not inside large Svelte components.

Proposed module layout:

```text
src/lib/types.ts
src/lib/db.ts
src/lib/roomCodes.ts
src/lib/itemNumbers.ts
src/lib/validation.ts
src/lib/imageCompression.ts
src/lib/filenames.ts
src/lib/csvExport.ts
src/lib/zipExport.ts
src/lib/passcode.ts
src/lib/theme.ts
```

Svelte components/routes handle UI and call these modules.

## Data model

### Project

```ts
Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  nextItemSequence: number
  lastRoom: string | null
  lastDimensionUnit: "mm" | "cm" | "m"
  lastExportedAt: string | null
  itemCountAtLastExport: number
}
```

### App settings

```ts
AppSettings {
  passcodeEnabled: boolean
  passcodeHash: string | null
  theme: "system" | "light" | "dark"
}
```

### Item

```ts
Item {
  id: string
  projectId: string
  itemNumber: string
  itemName: string
  room: string
  quantity: number
  length: number | null
  width: number | null
  height: number | null
  dimensionUnit: "mm" | "cm" | "m"
  notes: string
  status: "draft" | "saved"
  createdAt: string
  updatedAt: string
}
```

Required fields before final save:

- `itemName`
- `room`
- `quantity`

Defaults:

- `quantity = 1`
- `dimensionUnit = "mm"`
- `room = previous item room`, when available

Item numbers are auto-generated and locked once saved. If room is edited later, the item number does not change.

### Image

```ts
Image {
  id: string
  projectId: string
  itemId: string
  blob: Blob
  filename: string
  mimeType: string
  size: number
  createdAt: string
  sortOrder: number
}
```

Images are compressed to medium quality before storage/export:

- max width around `1600–2000px`
- JPEG quality around `0.75–0.85`

## IndexedDB/Dexie stores

Proposed stores:

```ts
projects: (id, name, updatedAt);
items: (id, projectId, itemNumber, room, itemName, status, updatedAt);
images: (id, projectId, itemId, sortOrder, createdAt);
settings: key;
```

Use Dexie transactions for operations that must remain consistent, e.g. finalizing an item, deleting an item and its images, deleting a project.

## Room codes and item numbers

Room codes are stored in a configurable dictionary:

```ts
const ROOM_CODES = {
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
};
```

Item numbers use the room code plus a global project sequence:

```text
LR-001
LR-002
BR-003
KIT-004
```

The sequence does not reset per room. If room text is unknown, generate a fallback room code from the room text or use `RM`.

## Main workflow

### Home screen

- List projects.
- Create project.
- Open project.
- Export project.
- Delete project.
- Access settings.

### Project screen

Primary action:

- `Add Item`

Secondary actions:

- `Review Items`
- `Export ZIP`
- `Settings`

### Add item flow

1. Create an internal draft for recovery.
2. Take/add one or more photos.
3. Compress and autosave photos immediately.
4. Enter item fields.
5. Generate item number from room code and next global sequence.
6. Enable save only once required fields are valid.
7. Save or `Save & Add Next`.

`Save & Add Next`:

- finalizes the item
- locks the item number
- carries over room and unit
- resets quantity to `1`
- starts the next draft

Drafts can exist internally, but an item cannot be finalized without required fields.

## Review screen

Features:

- Thumbnail list of items.
- Search by item number, item name, room, or notes.
- Filter by room.
- Edit item fields, with item number read-only.
- Add/remove photos.
- Delete items.

## Export format

Each project exports as one ZIP:

```text
project-name_2026-05-28.zip
  items.csv
  items.json
  images/
    project-name_LR-001_01.jpg
    project-name_LR-001_02.jpg
    project-name_BR-003_01.jpg
```

CSV columns:

```text
item_number
item_name
room
quantity
length
width
height
unit
notes
image_filenames
created_at
updated_at
```

Multiple image filenames are stored in one CSV field separated by semicolons.

`items.json` contains the full project/item/image metadata, excluding raw image blobs.

## Data safety

Use IndexedDB for all project, item, and image data. Do not use `localStorage` for real data/images.

Autosave when:

- project is created/updated
- photo is added/removed
- draft fields change, debounced
- item is finalized/saved
- item is deleted
- project is exported

If a draft exists when reopening a project, prompt to continue it.

Show backup reminders:

- if a project has never been exported
- after every 10 saved items since last export
- when opening a project with unexported changes

## Security

Use a simple app-wide passcode gate. Store a passcode hash locally. This is casual protection only, not encrypted storage.

## PWA behavior

- Installable on iPhone home screen.
- App manifest with name, icon, theme color, and standalone display mode.
- Service worker caches app shell/assets.
- App should load offline after first successful visit/install.
- All project/item/photo work should function offline.
- Export should function offline.

## UI approach

- Mobile-first, optimized for portrait iPhone.
- Usable on Android and desktop as secondary targets.
- Large touch-friendly buttons and form controls.
- Minimal navigation depth.
- Plain CSS with CSS variables.
- Light/dark/system theme support.
- Keep components simple and task-focused.

## Testing approach

### Unit tests with Vitest

Test pure TypeScript logic:

- room name normalization
- room code generation
- fallback room code generation
- item number formatting
- required field validation
- filename generation
- CSV escaping
- CSV generation
- export metadata generation
- passcode hashing/checking

### Storage tests with Vitest + fake-indexeddb

Test Dexie/database behavior:

- create project
- update project
- create draft item
- finalize item
- carry over previous room/unit
- save image metadata/blob
- delete image
- delete item and related images
- delete project and related items/images
- draft recovery query
- backup reminder calculations

### Browser/e2e tests with Playwright

Test main user flows:

- create project
- add item without photos
- add item with test image upload
- validation blocks save until required fields exist
- `Save & Add Next` carries room/unit and resets quantity
- reload page and confirm data persists
- review/search/filter items
- edit item fields while item number remains read-only
- delete item
- export ZIP

### Manual iPhone test checklist

Run on a real iPhone/Safari before considering the MVP usable:

- open hosted app
- add to Home Screen
- launch as installed PWA
- create project
- take multiple photos from camera input
- confirm photos compress/store successfully
- close/reopen app and verify data remains
- airplane mode: open app and add/edit data
- export ZIP
- send/open ZIP on Windows
- confirm CSV and images are correct

## MVP phases

### Phase 1: Skeleton and storage

- SvelteKit project setup.
- PWA plugin setup.
- Basic routes/layout.
- Dexie schema.
- Project creation/listing/deletion.
- Basic tests for data model/storage.

### Phase 2: Item entry

- Add item form.
- Required field validation.
- Room code and item number generation.
- Draft creation/recovery.
- Save and `Save & Add Next`.
- Review list without advanced search.

### Phase 3: Photos

- Camera/file input.
- Multiple photos per item.
- Image compression.
- Store blobs in IndexedDB.
- Thumbnails in review screen.
- Add/remove photos.

### Phase 4: Export

- CSV generation.
- JSON metadata generation.
- ZIP with images folder.
- Download/share ZIP.
- Mark project as exported.

### Phase 5: Polish/reliability

- Search/filter review screen.
- Backup reminders.
- App-wide passcode gate.
- Mobile UI improvements.
- Full Playwright flow tests.
- Real iPhone manual testing.
