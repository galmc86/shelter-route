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
- [ ] Redesign the main panel into explicit modes: `Emergency`, `Nearby`, `Route`, `Family`
- [x] Make the primary task visible by default instead of hiding route planning behind a toggle
- [ ] Add a persistent status strip for alert state, location mode, connectivity, and data freshness
- [ ] Validate the new mode model on mobile and desktop layouts

Notes:
- This is the highest-leverage UX change because it reduces cognitive load across the whole app.
- The temporary utility tabs were replaced by section-level navigation because they were effectively hidden on mobile.
- The initial mobile bottom-nav experiment was superseded by a lighter glass overlay switcher to avoid creating a second competing bottom surface.

### Epic 2: Shelter Decision Quality
Objective: help users choose the best shelter, not just the nearest one.
Status: `[ ]`

- [ ] Define a unified shelter trust/ranking model from accessibility, capacity, community reports, and freshness/confidence
- [ ] Update shelter sorting/ranking logic to reflect trust and urgency
- [ ] Redesign shelter result cards into primary vs secondary information layers
- [ ] Expose ranking rationale in the UI where needed
- [ ] Verify trust/ranking behavior with automated tests

Notes:
- This should improve both safety and product differentiation.

### Epic 3: App-State Refactor Foundation
Objective: reduce mode coupling and regression risk.
Status: `[ ]`

- [ ] Refactor `useAppController` into clearer domain state slices
- [ ] Define state boundaries for `routeSession`, `proximitySearch`, `emergencyAlert`, and `navigation`
- [ ] Keep contexts as projections of state instead of primary orchestration
- [ ] Split `SearchPanel` into mode-specific subviews
- [ ] Add provider-level integration tests around the new state model

Notes:
- This is the main architecture cleanup needed before larger feature growth.

### Epic 4: Safety-Critical Test Hardening
Objective: lock down the core emergency and lookup flows.
Status: `[~]`

- [x] Add automated coverage for the saved-places flow
- [ ] Expand automated coverage for emergency mode and location fallback
- [ ] Expand automated coverage for route planning and route alternatives
- [ ] Reduce reliance on full-tree mocking in app integration tests
- [ ] Define a stable PR test gate for safety-critical flows

Notes:
- Saved places are already covered by unit, integration, and E2E checks.

## Next

### Epic 5: Offline Resilience Pack
Objective: remain useful during degraded connectivity.
Status: `[ ]`

- [ ] Define the offline emergency experience
- [ ] Cache last-known safety-critical data intentionally
- [ ] Surface stale/confidence indicators clearly
- [ ] Add automated tests for degraded/offline flows

### Epic 6: Proactive Alert-to-Shelter Flow
Objective: reduce reaction time after alerts.
Status: `[ ]`

- [ ] Improve alert-triggered emergency handoff
- [ ] Strengthen notification behavior and fallback handling
- [ ] Make the next action immediately obvious after an alert
- [ ] Validate behavior under permission-denied and location-failure scenarios

### Epic 7: MapView Decomposition
Objective: make map behavior safer to evolve.
Status: `[ ]`

- [ ] Split route rendering into a dedicated map layer hook/controller
- [ ] Split shelter markers/popups into a dedicated map layer hook/controller
- [ ] Split user location and emergency radius into dedicated map layer hooks/controllers
- [ ] Split heat map behavior into a dedicated map layer hook/controller
- [ ] Reduce `MapView` to map ownership and composition

### Epic 8: Automation Expansion
Objective: cover degraded and cross-browser behavior.
Status: `[ ]`

- [ ] Add E2E coverage for offline mode
- [ ] Add E2E coverage for location fallback
- [ ] Add E2E coverage for navigation start/cancel
- [ ] Add E2E coverage for route alternatives
- [ ] Expand browser/device coverage once the PR suite is stable

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
Status: `[ ]`

- [ ] Add richer profile behavior for Home/Work/School
- [ ] Support one-tap actions per profile
- [ ] Add route presets and last-used behavior
- [ ] Expose profile-specific safety signals

### Epic 11: Adaptive Large-Screen Experience
Objective: improve tablet/desktop usability.
Status: `[ ]`

- [ ] Move from a resized single panel to a true list-detail/task layout
- [ ] Keep map and active task visible simultaneously on larger screens
- [ ] Rebalance information density for desktop/tablet layouts
- [ ] Validate responsive behavior across supported breakpoints

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
