# Deploying Furniture Survey

## Easiest free deployment: Netlify

Netlify gives you a free HTTPS subdomain like `your-survey.netlify.app`, which is enough for the PWA/install/offline features.

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Create a free Netlify account: <https://app.netlify.com/signup>
3. Click **Add new site → Import an existing project**.
4. Select the repo.
5. Use these build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `build`
6. Deploy.
7. Create/rename the free domain:
   - Open **Site configuration → Site details → Change site name**.
   - Pick a unique name, e.g. `my-furniture-survey`.
   - Your app URL becomes `https://my-furniture-survey.netlify.app`.

The `static/_redirects` file handles direct links/reloads for the static SvelteKit app.

## Optional Docker image

Use Docker if you want to run it on a VPS, NAS, or any container host:

```bash
docker build -t furniture-survey .
docker run --rm -p 8080:80 furniture-survey
```

Then open `http://localhost:8080`.

For a public deployment, put the container behind a HTTPS reverse proxy (Caddy, Traefik, Nginx Proxy Manager, etc.) and point a domain/subdomain at that server.

## Important note

All survey data is stored in the browser IndexedDB for the exact domain. If you change from one domain to another, export ZIP backups first, because the new domain will have separate local storage.
