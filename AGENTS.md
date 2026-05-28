# AGENTS.md

## Useful commands

```bash
mise install          # install/use the pinned Node version from mise.toml
npm install           # install project dependencies into local node_modules/
npm run dev           # start local dev server
npm run check         # run Svelte/TypeScript checks
npm run lint          # run Prettier check and ESLint
npm run format        # auto-format files
npm run test:unit -- --run
npm run test:e2e      # run Playwright browser tests
npm run build         # build static production site
npm run preview       # preview production build locally
```

If Playwright reports missing browser system dependencies, run:

```bash
sudo npx playwright install-deps
```

## Short architecture summary

Mobile-first, local-first SvelteKit PWA using TypeScript. The app is built as a static site and runs mostly in the browser with no MVP backend.

Core data lives in IndexedDB via Dexie: projects, items, images, and settings. Business logic should live in small modules under `src/lib`; Svelte routes/components should mostly handle UI and call those modules.

Planned key libraries:

- SvelteKit + TypeScript for UI/app structure
- Dexie for IndexedDB storage
- vite-plugin-pwa for manifest/service worker/offline app shell
- browser-image-compression for photo compression
- JSZip for ZIP export
- Vitest + fake-indexeddb for unit/storage tests
- Playwright for browser/e2e tests
