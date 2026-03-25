# Roadmap Tracker

This file is the persistent execution plan for the project.
Use it to track what is planned, in progress, and completed across sessions.

Status key:

- `[ ]` not started
- `[~]` in progress
- `[x]` completed

## Now

### Epic 1: Mode-Based App Experience
Objective: make the app immediately understandable under stress.
Status: `[~]`

- [x] Introduce utility-panel tabs so Family and Dashboard no longer stack beneath Search
- [x] Introduce top-level `Nearby` and `Route` search surface tabs inside `SearchPanel`
- [x] Replace the stacked-utility panel with app-level section navigation and a mobile glass overlay switcher
- [x] Redesign the main panel into explicit modes: `Emergency`, `Nearby`, `Route`, `Family`
- [x] Make the primary task visible by default instead of hiding route planning behind a toggle
- [ ] Add a persistent status strip for alert state, location mode, connectivity, and data freshness
- [x] Validate the new mode model on mobile and desktop layouts

Notes:
- This is the highest-leverage UX change because it reduces cognitive load across the whole app.
- The temporary utility tabs were replaced by section-level navigation because they were effectively hidden on mobile.
- The initial mobile bottom-nav experiment was superseded by a lighter glass overlay switcher to avoid creating a second competing bottom surface.
- A global status strip was tested locally and rejected because it made the mobile shell feel crowded; contextual state should live inside the active surface instead.
- Dedicated `Family` and `Dashboard` sections now open as content-first sheets instead of requiring a second accordion tap after section switching.
- Emergency mode now renders as a dedicated surface and auto-expands the mobile sheet so it does not inherit stale route UI or hide behind the collapsed state.

### Epic 2: Shelter Decision Quality
Objective: help users choose the best shelter, not just the nearest one.
Status: `[x]`

- [x] Define a unified shelter trust/ranking model from accessibility, capacity, community reports, and freshness/confidence
- [x] Update shelter sorting/ranking logic to reflect trust and urgency
- [x] Redesign shelter result cards into primary vs secondary information layers
- [x] Expose ranking rationale in the UI where needed
- [x] Verify trust/ranking behavior with automated tests

Notes:
- This should improve both safety and product differentiation.
- Nearby and emergency flows now default to a recommended ranking that combines walking time, distance, accessibility, capacity occupancy, community status, and freshness when data is available.
- The top recommended shelter now surfaces a short rationale in the results list instead of leaving the recommendation implicit.
- Shelter result cards now prioritize the decision layer first: name, distance, walk time, accessibility, and capacity summary, with address and the occupancy bar moved into a quieter secondary layer.

### Epic 3: App-State Refactor Foundation
Objective: reduce mode coupling and regression risk.
Status: `[x]`

- [x] Refactor `useAppController` into clearer domain state slices
- [x] Define state boundaries for `routeSession`, `proximitySearch`, `emergencyAlert`, and `navigation`
- [x] Keep contexts as projections of state instead of primary orchestration
- [x] Split `SearchPanel` into mode-specific subviews
- [x] Add provider-level integration tests around the new state model

Notes:
- This is the main architecture cleanup needed before larger feature growth.
- Lookup-mode transitions for `emergency`, `nearby`, saved-place lookup, and panel expansion now live in `useLookupModeState`, giving `useAppController` a first extracted domain seam without changing the UI model.
- Alert-triggered emergency activation, sound, vibration, and dismiss cleanup now live in `useEmergencyAlertEffects`, separating emergency alert side effects from the main controller flow.
- Shared-route URL bootstrap, share metadata, and route-search analytics now live in `useRouteSessionState`, reducing route-session concerns inside `useAppController`.
- Shelter navigation handoff, deferred location retry, and panel open/close behavior now live in `useShelterNavigationFlow`, giving navigation its own explicit seam.
- Active lookup derivation, nearest-shelter triggering, and proximity-vs-route shelter selection now live in `useProximitySearchState`, separating proximity search behavior from the main controller.
- Emergency and nearby lookup actions, alert-triggered activation, last-known fallback, and map-center fallback now live in `useEmergencyLookupFlow`, leaving `useAppController` primarily responsible for composing domain hooks plus app-shell state.
- Route, emergency, and shelter context payloads now live in `useAppControllerContexts`, so `useAppController` is mostly orchestration plus returned API shape.
- `useAppController` now has direct integration coverage for saved-place lookup, route-search reset behavior, and alert-triggered emergency activation through the composed controller state.

### Epic 4: Safety-Critical Test Hardening
Objective: lock down the core emergency and lookup flows.
Status: `[x]`

- [x] Add automated coverage for the saved-places flow
- [x] Expand automated coverage for emergency mode and location fallback
- [x] Expand automated coverage for route planning and route alternatives
- [x] Reduce reliance on full-tree mocking in app integration tests
- [x] Define a stable PR test gate for safety-critical flows

Notes:
- Saved places are already covered by unit, integration, and E2E checks.
- Emergency E2E coverage now targets the current `emergency-mode-surface`, validates the navigate CTA, and verifies the `Use map center` fallback when geolocation is unavailable.
- Route planning and route alternatives now have deterministic integration coverage, including a StrictMode regression test that preserves shared-route bootstrap from URL params during development.
- `App.test.tsx` now consumes the real route, emergency, and shelter providers via a context probe instead of intercepting provider props, so controller composition is exercised end-to-end inside the app shell tests.
- The stable PR gate is now `npm run test:pr:safety`, which runs Vitest, production build verification, and the critical Chromium E2E flows for emergency mode and saved places.

## Next

### Epic 5: Offline Resilience Pack
Objective: remain useful during degraded connectivity.
Status: `[x]`

- [x] Define the offline emergency experience
- [x] Cache last-known safety-critical data intentionally
- [x] Surface stale/confidence indicators clearly
- [x] Add automated tests for degraded/offline flows

Notes:
- Emergency mode now shows an in-panel offline/stale-data notice so degraded network conditions are explicit inside the highest-priority flow, not only in the global shell.
- Shelter data status is now reactive, preserves the real fetch timestamp during reverse-geocode enrichment, and surfaces cached/stale confidence in the search UI instead of hiding it in the service layer.
- Successful geolocation now persists a last-known device location, and emergency mode can reuse it as a dedicated fallback instead of forcing the user to start from the map center.
- Playwright now covers the degraded-network emergency case where shelters were already loaded, the network drops, and the emergency surface keeps working with an explicit offline notice.

### Epic 6: Proactive Alert-to-Shelter Flow
Objective: reduce reaction time after alerts.
Status: `[x]`

- [x] Improve alert-triggered emergency handoff
- [x] Strengthen notification behavior and fallback handling
- [x] Make the next action immediately obvious after an alert
- [x] Validate behavior under permission-denied and location-failure scenarios

Notes:
- Alert-triggered emergency activation now auto-falls back to the last known location when live geolocation fails, so the user gets a shelter recommendation immediately instead of needing a second manual action.
- Playwright now covers both unsupported geolocation and permission-denied recovery paths, including the last-known-location fallback button when live location access is rejected.
- `useEmergencyAlertEffects` now cancels pending delayed activation when an alert clears or is dismissed immediately, preventing stale emergency handoffs after transient alert state changes.
- The alert banner CTA now describes the actual next step, and switches copy when emergency mode is already open so the user understands whether the action will open or refresh shelter guidance.

### Epic 7: MapView Decomposition
Objective: make map behavior safer to evolve.
Status: `[x]`

- [x] Split route rendering into a dedicated map layer hook/controller
- [x] Split shelter markers/popups into a dedicated map layer hook/controller
- [x] Split user location and emergency radius into dedicated map layer hooks/controllers
- [x] Split heat map behavior into a dedicated map layer hook/controller
- [x] Reduce `MapView` to map ownership and composition

Notes:
- Route polylines, endpoint markers, and the route picker overlay now live in a dedicated `useRouteLayer` hook, reducing the size and branching inside `MapView` without changing route behavior.
- Shelter marker creation, popup React roots, popup lifecycle cleanup, and selected-shelter reopening now live in `useShelterMarkersLayer`, further shrinking `MapView` to map ownership plus composed layer hooks.
- User location marker, emergency walking-radius circle, and the emergency fit-bounds behavior now live in `useUserLocationEmergencyLayer`, which also makes the shelter marker opacity use an explicit radius value instead of an implicit mutable ref.
- Heat map visibility state, toggle control, zoom-aware alert circles, and legend now live in `useHeatMapLayer`, leaving `MapView` closer to pure layer composition instead of mixed map UI management.
- Shelter-navigation polylines and their fit-bounds behavior now live in `useNavigationRouteLayer`, leaving `MapView` responsible primarily for map bootstrap, cluster ownership, and composing layer hooks.

### Epic 8: Automation Expansion
Objective: cover degraded and cross-browser behavior.
Status: `[x]`

- [x] Add E2E coverage for offline mode
- [x] Add E2E coverage for location fallback
- [x] Add E2E coverage for navigation start/cancel
- [x] Add E2E coverage for route alternatives
- [x] Expand browser/device coverage once the PR suite is stable

Notes:
- Playwright now covers the internal shelter-navigation handoff from emergency results into `NavigationPanel`, including canceling back to the emergency surface after the route overlay is active.
- Playwright now also covers a real route-planning flow with multiple ORS alternatives, including switching the active route from both the panel selector and the map overlay route picker.
- The critical Playwright safety suite now runs on both desktop Chromium and a mobile Chromium device profile (`Pixel 7`), giving the PR gate real mobile-layout coverage without taking on full cross-browser maintenance yet.
- The popup-driven marker-to-navigation handoff remains a desktop-critical check for now; mobile critical coverage focuses on emergency entry/fallback and saved-place flows where the sheet-first layout is the primary user path.

## Later

### Epic 9: Family Safety Sync
Objective: turn the family feature into a real retention loop.
Status: `[ ]`

- [ ] Add cross-device shared family state
- [ ] Support invite/join flows
- [ ] Add alert-triggered “I’m safe” coordination
- [ ] Define persistence/auth approach

### Epic 10: Saved Places to Safety Profiles
Objective: turn saved locations into reusable routines.
Status: `[x]`

- [x] Add richer profile behavior for Home/Work/School
- [x] Support one-tap actions per profile
- [x] Add last-used behavior for saved profiles
- [x] Add route presets for saved profiles
- [x] Expose profile-specific safety signals

Notes:
- `Home`, `Work`, and `School` now behave like replaceable singleton profiles instead of consuming new slots every time the user re-saves them.
- Saved profiles now persist `lastUsedAt` metadata and surface a lightweight recent-use badge in the nearby search UI, while still keeping `Other` locations multi-entry.
- Saved profile chips now expose a direct route-start action that switches the panel into `Route` mode with the chosen place prefilled as the origin.
- Saved profile chips now surface a compact proximity hint for the closest shelter, and flag profiles that already have an accessible shelter within the local nearby radius.
- Running a route search from a saved profile origin now persists the destination and travel mode as that profile's route preset, and reusing the route action will immediately launch the saved route instead of only prefilling the origin.

### Epic 11: Adaptive Large-Screen Experience
Objective: improve tablet/desktop usability.
Status: `[~]`

- [ ] Move from a resized single panel to a true list-detail/task layout
- [x] Keep map and active task visible simultaneously on larger screens
- [x] Rebalance information density for desktop/tablet layouts
- [ ] Validate responsive behavior across supported breakpoints

Notes:
- Desktop now uses a dedicated task rail instead of reusing the mobile floating glass switcher, so the map stays unobstructed while the active task remains visible.
- Mobile keeps the glass section switcher anchored at the top of the map; the desktop rail layout is viewport-gated so the larger-screen work does not regress the phone shell.
- The desktop search rail now separates the task composer from the scrollable results area, so route setup and nearby controls stay stable while shelter results and route options can grow independently.

## Suggested Execution Order

- [ ] 1. Mode-based UX redesign
- [ ] 2. `useAppController` refactor
- [ ] 3. Shelter trust and ranking improvements
- [ ] 4. Core QA gate expansion
- [ ] 5. Offline resilience
- [ ] 6. Alert-to-shelter autopilot
- [ ] 7. MapView decomposition
- [ ] 8. Family sync
- [ ] 9. Saved place profiles
- [ ] 10. Adaptive large-screen redesign

## Already Completed

- [x] Implement saved places nearby-shelter flow
- [x] Add tests for saved places at unit, integration, and E2E levels
- [x] Rename “My Shelters” feature copy to “Saved Places”

## Notes For Future Sessions

- Update checklist states when work starts or finishes
- Add decisions/rationale under the relevant epic instead of leaving them only in chat history
- When starting a new session, point the assistant to this file directly
