# Family Sync Worker

This worker backs cross-device family sync for the main app.

## What It Stores

- family group records by invite code
- member identity and safety status
- record version numbers for optimistic concurrency

## Prerequisites

- Cloudflare account with Workers + KV access
- Wrangler installed via this package's dev dependencies

## First-Time Setup

1. Install worker dependencies:

```bash
cd workers/family-sync
npm install
```

2. Create the KV namespaces:

```bash
npx wrangler kv:namespace create FAMILY_GROUPS
npx wrangler kv:namespace create FAMILY_GROUPS --preview
```

3. Copy the returned IDs into [wrangler.toml](/Users/gal.machluf/projects/shelter-finder/workers/family-sync/wrangler.toml):

- `[[kv_namespaces]].id`
- `[[kv_namespaces]].preview_id`

4. Update `ALLOWED_ORIGINS` so the deployed frontend origin is allowed.

## Local Development

```bash
cd workers/family-sync
npm run dev
```

That serves the worker locally through Wrangler.

## Deploy

```bash
cd workers/family-sync
npm run deploy
```

After deploy:

1. Copy the worker URL.
2. Set `VITE_FAMILY_REMOTE_URL` in the root app environment.
3. Run the root smoke test:

```bash
cd /Users/gal.machluf/projects/shelter-finder
VITE_FAMILY_REMOTE_URL=https://family-sync.<your-subdomain>.workers.dev npm run test:family:backend-smoke
```

## Expected Contract

The worker currently exposes:

- `GET /:groupCode`
- `PUT /:groupCode`
- `DELETE /:groupCode`

Write requests require session headers:

- `X-Family-Device-Id`
- `X-Family-User-Id` (optional)
- `X-Family-Auth-State`

## Safety Notes

- Writes are session-scoped.
- A device can only create a group if it is included in the submitted members.
- Joining can add only the requesting device/member without mutating existing members.
- Existing members can update only their own membership state.
- Deletion is allowed only for the last remaining member.
