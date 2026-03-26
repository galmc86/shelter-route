# Family Sync Worker

This worker backs cross-device family sync for the main app.

## What It Stores

- family group records by invite code
- member identity and safety status
- record version numbers for optimistic concurrency

## Prerequisites

- Cloudflare account with Workers + Durable Objects access
- Wrangler installed via this package's dev dependencies

## First-Time Setup

1. Install worker dependencies:

```bash
cd workers/family-sync
npm install
```

2. Update `ALLOWED_ORIGINS` so the deployed frontend origin is allowed.

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

That smoke path now covers authenticated same-user rejoin as well as create/join/leave/delete.
It also supports `--group-code=<code>` for reproducible runs and `--no-auth-rejoin` when you want to isolate the non-auth backend path first.

4. Optionally run the browser-backed family E2E against the same worker:

```bash
cd /Users/gal.machluf/projects/shelter-finder
VITE_FAMILY_REMOTE_URL=https://family-sync.<your-subdomain>.workers.dev npm run test:e2e:family-backend
```

If you run that Playwright flow against a deployed worker from local dev, make sure `ALLOWED_ORIGINS` includes your local app origin such as `http://localhost:5174`.
The spec also verifies authenticated same-user rejoin, so a repeated `familyRemoteUserId` can move across device sessions without duplicating the shared family member record.

For authenticated-session QA without a full auth provider yet, the app can also bootstrap family sync identity from env or query params:

- `VITE_FAMILY_REMOTE_AUTH_STATE=authenticated`
- `VITE_FAMILY_REMOTE_USER_ID=<test-user-id>`
- or `?familyRemoteAuthState=authenticated&familyRemoteUserId=<test-user-id>`

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
