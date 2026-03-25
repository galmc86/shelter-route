# Family Sync Plan

## Goal

Turn the existing local-only family safety feature into a cross-device coordination flow without rewriting the current UI again when remote sync arrives.

## Current Baseline

The app already has these local-first pieces:

- `create` and `join` family flows
- invite code and share link UX
- alert-triggered check-in reset for the current member
- one-tap "I'm safe" actions in alert/debrief surfaces
- centralized family UI state via [`useFamilyGroupState`](/Users/gal.machluf/projects/shelter-finder/src/hooks/useFamilyGroupState.ts)
- versioned local persistence in [`familySafetyService.ts`](/Users/gal.machluf/projects/shelter-finder/src/services/familySafetyService.ts)

That is enough to define the remote model and introduce a repository seam before adding backend infrastructure.

## Product Constraints

- Family check-in must remain useful when the user is offline.
- The local user should always be able to mark themselves safe immediately.
- Remote sync should be additive; it must not block the current local safety flow.
- Invite and join UX should keep the current short-code mental model.
- The app should tolerate partial adoption, where one device is signed in and another still uses local-only state.

## Proposed Architecture

Introduce a repository boundary with a gateway seam:

1. `LocalFamilyRepository`
   - wraps the current `localStorage` behavior
   - remains the default fallback
   - supports optimistic updates while offline

2. `FamilyRemoteGateway`
   - defines the transport-facing contract for group fetch, upsert, clear, and subscription
   - can be implemented by a mock local gateway first and a real backend later

3. `RemoteFamilyRepository`
   - composes local state with the remote gateway
   - handles join, membership updates, safe-status updates, and subscriptions

Then add a `HybridFamilyRepository` coordinator:

- reads from local state immediately on app start
- hydrates from remote when auth/session is available
- writes optimistic local updates first
- syncs remote in the background
- exposes conflict-free read models to the UI

UI code should talk only to the repository boundary, never directly to `localStorage` or transport APIs.

## Data Model

### Family Group

```ts
type FamilyGroupRecord = {
  id: string;
  inviteCode: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  createdByMemberId: string;
};
```

### Family Member

```ts
type FamilyMemberRecord = {
  id: string;
  groupId: string;
  userId?: string;
  deviceId?: string;
  name: string;
  role: 'owner' | 'member';
  status: 'safe' | 'needs_check_in' | 'unknown';
  lastStatusAt?: string;
  lastSeenAt?: string;
  joinedAt: string;
};
```

### Family Event

```ts
type FamilyEventRecord = {
  id: string;
  groupId: string;
  memberId: string;
  type: 'joined' | 'left' | 'safe' | 'needs_check_in';
  createdAt: string;
  source: 'local' | 'remote';
};
```

This event layer is optional for the first backend version, but it gives a clean audit trail and makes conflict handling easier later.

## Repository Interface

Add a shared interface in `src/services/family/repository/`:

```ts
interface FamilyRepository {
  getSnapshot(): Promise<FamilyGroupView | null>;
  subscribe(listener: () => void): () => void;
  createGroup(name: string): Promise<FamilyGroupView>;
  joinGroup(code: string, name: string): Promise<FamilyGroupView>;
  markCurrentMemberSafe(): Promise<FamilyGroupView | null>;
  markCurrentMemberNeedsCheckIn(): Promise<FamilyGroupView | null>;
  leaveGroup(): Promise<void>;
  getShareLink(): Promise<string | null>;
}
```

`FamilyGroupView` should stay close to the current UI shape so the existing components need minimal changes.

## Auth Approach

Use lightweight account identity only when remote sync is enabled.

Recommended path:

- anonymous device session first for basic remote group presence
- upgrade to authenticated identity only when the user wants durable cross-device membership
- keep the invite code as the join entry point regardless of auth state

Why:

- the current feature is safety-focused, not social-first
- forcing sign-in before "I'm safe" coordination would increase friction
- anonymous bootstrap + later upgrade gives the fastest path to usable sync

## Sync Strategy

### Local-first behavior

- update local state immediately
- reflect UI state instantly
- enqueue remote mutation if remote repository is active

### Remote hydration

- on startup, load local snapshot first
- if authenticated or otherwise eligible for remote sync, fetch remote group
- merge by `groupId` / `inviteCode`
- prefer newest `lastStatusAt` for member safety state

### Conflict rules

- `safe` and `needs_check_in` are last-write-wins using server timestamp when available
- membership removal beats local stale membership
- invite code is immutable after group creation in v1

## Rollout Plan

### Phase 1

- add repository interface
- move current service behind `LocalFamilyRepository`
- keep all UI behavior unchanged

### Phase 2

- add remote gateway contract and mock implementation
- add hybrid repository wiring
- keep remote feature behind a flag
- allow hybrid mode to be enabled in development with `?familySyncMode=hybrid` or `VITE_FAMILY_SYNC_MODE=hybrid`

### Phase 3

- add auth/session bootstrap
- support real cross-device membership
- add reconciliation telemetry and error reporting

## Migration Steps

1. Wrap current `familySafetyService` behind a repository interface.
2. Update `useFamilyGroupState` to depend on the repository, not raw service functions.
3. Add app-level repository provider/context.
4. Introduce remote repository behind a feature flag.
5. Migrate local storage shape from "UI-owned" to "repository-owned".

## Success Criteria

- Existing local family UX keeps working with no visual regression.
- A second device can join the same family group and receive member status updates.
- Offline safe-check-ins still update local UI immediately.
- When sync fails, the user can still complete the local emergency/check-in flow.

## Open Questions

- Do we want one family group per signed-in user, or support multiple groups later?
- Is anonymous remote membership acceptable for the first production release?
- Which backend will own realtime subscriptions for member status changes?
- Do we need server-generated check-in campaigns per alert region, or is client-triggered reset sufficient for v1?
