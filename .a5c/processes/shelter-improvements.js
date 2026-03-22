/**
 * @process shelter-improvements
 * @description Shelter Route app comprehensive improvements - 34 items across 5 phases
 * @inputs { planFile: string, projectRoot: string }
 * @outputs { success: boolean, phasesCompleted: number, itemsCompleted: number }
 *
 * @skill frontend-design specializations/ux-ui-design/skills/frontend-design/SKILL.md
 * @agent ui-implementer specializations/ux-ui-design/agents/ui-implementer/AGENT.md
 * @agent accessibility-verifier specializations/ux-ui-design/agents/accessibility-verifier/AGENT.md
 * @agent test-strategy-architect specializations/qa-testing-automation/agents/test-strategy-architect/AGENT.md
 * @agent e2e-automation-expert specializations/qa-testing-automation/agents/e2e-automation-expert/AGENT.md
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

export async function process(inputs, ctx) {
  const { planFile, projectRoot } = inputs;

  // ============================================================================
  // PHASE 1: SAFETY-CRITICAL FIXES (Items 1-8)
  // ============================================================================

  ctx.log('info', 'Starting Phase 1: Safety-Critical Fixes');

  // Item 1: Alert Polling Recovery
  const item1 = await ctx.task(implementItemTask, {
    itemNumber: 1,
    title: 'Alert Polling Recovery with Exponential Backoff',
    description: `Fix the alert polling in src/services/orefAlertService.ts that permanently stops after 3 failures. Implement exponential backoff instead of permanent shutdown. Add a visible health status that can be consumed by UI components. The current code at lines 129-176 has MAX_CONSECUTIVE_FAILURES=3 and clears the interval permanently. Replace with: (1) exponential backoff starting at 5s, doubling up to 60s max, (2) reset backoff on successful poll, (3) add a healthStatus callback to subscribeToAlerts that reports 'connected'|'degraded'|'reconnecting', (4) never permanently stop polling. Also export a getAlertHealthStatus function. Keep the existing API contract but extend it.`,
    files: ['src/services/orefAlertService.ts', 'src/hooks/useOrefAlerts.ts'],
    projectRoot
  });

  // Item 2: Emergency Button Visibility
  const item2 = await ctx.task(implementItemTask, {
    itemNumber: 2,
    title: 'Emergency Button Always Visible on Mobile',
    description: `Fix emergency FAB being hidden when panel is expanded on mobile. In src/App.css around line 2448, the class .emergency-fab.fab-panel-expanded sets opacity:0 and pointer-events:none. Change this so the emergency button remains visible and tappable at all times regardless of panel state. Ensure it has proper z-index to float above the panel. Keep the button positioned so it doesn't overlap with critical panel controls. Test that it works with both collapsed and expanded panel states.`,
    files: ['src/App.css'],
    projectRoot
  });

  // Item 3: Audio Alert System
  const item3 = await ctx.task(implementItemTask, {
    itemNumber: 3,
    title: 'Add Audio Alert Using Web Audio API',
    description: `Add an audible alarm when OREF alerts are received. Currently src/App.tsx line 113 only uses navigator.vibrate. Add: (1) a Web Audio API-based alarm sound that plays a repeating urgent tone (alternating 800Hz and 600Hz sine waves, 200ms each), (2) continuous vibration pattern [200,100,200,100,400] that repeats while alert is active, (3) stop audio+vibration when alert is dismissed or expires, (4) respect a user preference for silent mode stored in localStorage. Create a new utility src/utils/alertSound.ts with functions: playAlertSound(), stopAlertSound(), isAlertSoundPlaying(). Import and use in the alert effect in App.tsx.`,
    files: ['src/App.tsx', 'src/utils/alertSound.ts'],
    projectRoot
  });

  // Item 4: Alert Banner Button Hierarchy
  const item4 = await ctx.task(implementItemTask, {
    itemNumber: 4,
    title: 'Improve Alert Banner Button Hierarchy',
    description: `Improve the AlertBanner button hierarchy in src/components/AlertBanner.tsx. While Find Shelter already has stronger styling, the Dismiss button should be hidden during active countdown. Changes: (1) Hide the Dismiss button entirely while countdown > 0 (isExpired is false), (2) Make Find Shelter button full-width during active countdown for maximum tap target, (3) Only show Dismiss after countdown expires, (4) Update the corresponding CSS in src/App.css for .alert-banner-actions, .alert-banner-find-btn, .alert-banner-dismiss-btn to support this conditional layout.`,
    files: ['src/components/AlertBanner.tsx', 'src/App.css'],
    projectRoot
  });

  // Item 5: Geolocation Fallback in Emergency
  const item5 = await ctx.task(implementItemTask, {
    itemNumber: 5,
    title: 'Add Geolocation Fallback in Emergency Mode',
    description: `Add a fallback mechanism when geolocation fails in emergency mode. Currently SearchPanel.tsx lines 288-289 just shows the error text. Add: (1) When locationError is set in emergency mode, show a "Use map center" button that uses the current map center coordinates as the user's location, (2) Add an onUseMapCenter callback prop to SearchPanel that gets the current map center from MapView, (3) When the user clicks "Use map center", call the emergency shelter finder with those coordinates, (4) Also add a small text instruction about enabling location permissions. Update the SearchPanel props interface and App.tsx to wire this up.`,
    files: ['src/components/SearchPanel.tsx', 'src/App.tsx'],
    projectRoot
  });

  // Item 6: Alert System Tests
  const item6 = await ctx.task(implementItemTask, {
    itemNumber: 6,
    title: 'Create Comprehensive Alert System Tests',
    description: `Create test files for the alert system - the most safety-critical code with zero coverage. Create src/services/__tests__/orefAlertService.test.ts with tests for: (1) matchUserToAlertRegion - users inside/outside/on-boundary of regions, (2) haversineKm accuracy with known distances, (3) getTimeToShelter for known cities and unknown locations, (4) subscribeToAlerts polling lifecycle - start, receive alerts, consecutive failures and recovery (with the new exponential backoff), cleanup on unsubscribe, (5) empty and malformed response handling, (6) the 2-minute active window filter. Mock fetch globally. Test the health status callback. Ensure all tests pass with vitest.`,
    files: ['src/services/__tests__/orefAlertService.test.ts', 'src/services/orefAlertService.ts'],
    projectRoot
  });

  // Item 7: React Error Boundary
  const item7 = await ctx.task(implementItemTask, {
    itemNumber: 7,
    title: 'Add React Error Boundary',
    description: `Add a React Error Boundary component that wraps the entire app. Create src/components/ErrorBoundary.tsx as a class component that: (1) catches JavaScript errors in the component tree, (2) shows a minimal emergency fallback UI with: the app title, emergency phone numbers (100 police, 101 ambulance, 102 fire), a "Reload" button, (3) logs the error to console for debugging, (4) supports both Hebrew and English (detect from document.documentElement.lang). Wrap the App contents in main.tsx or App.tsx with this ErrorBoundary. Style it in App.css with clear, high-contrast emergency-friendly styling.`,
    files: ['src/components/ErrorBoundary.tsx', 'src/App.tsx', 'src/App.css'],
    projectRoot
  });

  // Item 8: Label Simulated Capacity
  const item8 = await ctx.task(implementItemTask, {
    itemNumber: 8,
    title: 'Label Simulated Capacity Data',
    description: `Add a clear disclaimer to the simulated capacity data. The capacityService.ts uses Math.random() for fake occupancy. Changes: (1) In ShelterPopup.tsx, add a small info icon/text next to the capacity bar that says "Estimated" (Hebrew: "הערכה") with a tooltip explaining this is not real-time data, (2) In SearchPanel.tsx shelter list items, add a similar small "est." badge near capacity indicators, (3) Add the translations to src/i18n/translations.ts for both languages, (4) Style the disclaimer text to be subtle but readable. Do NOT remove the capacity feature - just clearly label it as estimated.`,
    files: ['src/components/ShelterPopup.tsx', 'src/components/SearchPanel.tsx', 'src/i18n/translations.ts', 'src/App.css'],
    projectRoot
  });

  // Phase 1 Quality Gate
  const phase1QA = await ctx.task(qualityGateTask, {
    phase: 1,
    title: 'Phase 1 Safety-Critical Quality Gate',
    checks: ['lint', 'typecheck', 'test', 'build'],
    projectRoot
  });

  await ctx.breakpoint({
    question: 'Phase 1 (Safety-Critical Fixes) is complete. Review the 8 items implemented and quality gate results. Approve to continue to Phase 2?',
    title: 'Phase 1 Complete - Safety-Critical Fixes',
    context: { runId: ctx.runId }
  });

  // ============================================================================
  // PHASE 2: CORE EXPERIENCE (Items 9-20)
  // ============================================================================

  ctx.log('info', 'Starting Phase 2: Core Experience Improvements');

  // Item 9: OREF Region Coverage Expansion
  const item9 = await ctx.task(implementItemTask, {
    itemNumber: 9,
    title: 'Expand OREF Alert Region Coverage',
    description: `Expand the ALERT_REGIONS in src/services/orefAlertService.ts from 22 cities to comprehensive coverage. (1) Add missing major cities and towns: Givatayim, Raanana, Kfar Saba, Eilat, Arad, Dimona, Yavne, Lod, Ramla, Beit Shemesh, Maalot-Tarshiha, Kiryat Motzkin, Kiryat Bialik, Tirat Carmel, Nesher, Or Akiva, Caesarea, Zichron Yaakov, Pardes Hanna, Hadera, Afula, Yokneam, Migdal HaEmek, Nazareth, Carmiel, and other settlements near Gaza and Lebanon borders. (2) Fix the fragile substring matching at lines 64-65 to use normalized exact matching with fuzzy fallback. (3) Add a fallback "general alert" mode that triggers for any OREF alert when the user's location doesn't match a specific region - show a generic warning with no countdown rather than silently ignoring.`,
    files: ['src/services/orefAlertService.ts'],
    projectRoot
  });

  // Item 11: Onboarding Flow
  const item11 = await ctx.task(implementItemTask, {
    itemNumber: 11,
    title: 'Create First-Time User Onboarding Flow',
    description: `Create a 3-step onboarding overlay for first-time users. Create src/components/Onboarding.tsx: Step 1 - "Welcome to Shelter Route" explains the app finds shelters along your route and during emergencies. Step 2 - Request location permission with context ("Location helps find shelters near you instantly"). Step 3 - Highlight the emergency button with explanation ("Tap the red button during an alert to find the nearest shelter"). Store completion in localStorage key 'shelter-route:onboarding-completed'. Show only once. Add translations to translations.ts for both Hebrew and English. Style as a semi-transparent overlay with cards. Add dismiss/skip button. Wire into App.tsx to show on first load when onboarding is not completed.`,
    files: ['src/components/Onboarding.tsx', 'src/App.tsx', 'src/App.css', 'src/i18n/translations.ts'],
    projectRoot
  });

  // Item 12: Shelters Near Me CTA
  const item12 = await ctx.task(implementItemTask, {
    itemNumber: 12,
    title: 'Add "Shelters Near Me" Primary CTA',
    description: `Add a prominent "Find shelters near me" button as the primary call-to-action in SearchPanel.tsx. This should appear before the origin/destination inputs and trigger geolocation + show nearby shelters on the map without requiring a destination. Changes: (1) Add a "Find shelters near me" button at the top of SearchPanel, styled prominently with location icon, (2) When clicked, trigger getLocation and use the current location to find nearest shelters (reuse the useNearestShelters hook logic but for non-emergency display), (3) Add "Plan a safe route" text/link that expands to show the existing origin/destination inputs, (4) The existing search flow should still work but be secondary to this quick action, (5) Add translations for new UI strings. This should work like a simplified non-emergency version of the emergency button.`,
    files: ['src/components/SearchPanel.tsx', 'src/App.tsx', 'src/App.css', 'src/i18n/translations.ts'],
    projectRoot
  });

  // Item 13: One-Tap Navigate
  const item13 = await ctx.task(implementItemTask, {
    itemNumber: 13,
    title: 'Add One-Tap Navigate to Nearest Shelter in Emergency',
    description: `In emergency mode, add a prominent "Navigate NOW" button that directly opens Google Maps directions to the nearest shelter without requiring the user to tap a shelter first and then tap navigate in the popup. In SearchPanel.tsx emergency mode section: (1) Auto-select the first (nearest) shelter in the list, (2) Show a large "Navigate to nearest shelter" button at the top of the emergency section with the shelter name and walking time, (3) This button should open Google Maps directions (or geo: URI for native maps) immediately, (4) Keep the shelter list below for alternative selection, (5) Style the button prominently - large, green background, clear icon.`,
    files: ['src/components/SearchPanel.tsx', 'src/App.css', 'src/i18n/translations.ts'],
    projectRoot
  });

  // Item 14: Continuous Geolocation
  const item14 = await ctx.task(implementItemTask, {
    itemNumber: 14,
    title: 'Switch to Continuous Geolocation in Emergency Mode',
    description: `Update useCurrentLocation.ts to use watchPosition instead of getCurrentPosition during emergency mode. (1) Add a 'continuous' parameter to the hook or create a separate useContinuousLocation mode, (2) When emergency mode is active, switch to watchPosition to continuously track the user's movement, (3) Update location state as new positions come in, (4) Clean up the watcher when emergency mode ends, (5) Show a position age indicator if last fix is >30 seconds old, (6) Wire this into App.tsx so that when emergencyMode is true, continuous tracking is active.`,
    files: ['src/hooks/useCurrentLocation.ts', 'src/App.tsx'],
    projectRoot
  });

  // Item 15: Walking-Time Isochrone
  const item15 = await ctx.task(implementItemTask, {
    itemNumber: 15,
    title: 'Add Walking-Time Isochrone in Emergency Mode',
    description: `Add a translucent radius circle on the map during emergency mode that shows how far the user can walk within the alert countdown time. In MapView.tsx: (1) When emergency mode is active and there's a countdown, calculate the walking distance radius: (countdownSeconds * 5000/3600) * 0.8 meters (walking speed 5km/h with 20% overhead factor), (2) Draw a Leaflet circle centered on the user's location with that radius, styled as a semi-transparent green fill, (3) Shelters inside the circle should have normal markers, shelters outside should appear dimmed/greyed, (4) Update the circle dynamically as countdown decreases, (5) Remove the circle when emergency mode ends. Add necessary props for countdown time to MapView.`,
    files: ['src/components/MapView.tsx', 'src/App.tsx', 'src/App.css'],
    projectRoot
  });

  // Item 16: Bottom Sheet Swipe Gestures
  const item16 = await ctx.task(implementItemTask, {
    itemNumber: 16,
    title: 'Add Bottom Sheet Swipe Gestures on Mobile',
    description: `Add touch drag gestures to the mobile bottom sheet panel in SearchPanel.tsx. (1) Implement touch event handlers (touchstart/touchmove/touchend) on the panel-handle and optionally the panel header area, (2) Add three snap points: peek (80px showing only handle), half (40vh showing search form), full (85vh showing everything), (3) Use velocity-based snapping - fast flick up/down snaps to next/prev point, slow drag snaps to nearest, (4) Add CSS transitions for smooth animations between snap points, (5) Update the panel state management to track these 3 states instead of just collapsed/expanded, (6) The onTogglePanel callback should cycle through states, (7) Ensure this works well with the existing panel content scrolling.`,
    files: ['src/components/SearchPanel.tsx', 'src/App.css'],
    projectRoot
  });

  // Item 17: Persistent Countdown Badge
  const item17 = await ctx.task(implementItemTask, {
    itemNumber: 17,
    title: 'Add Persistent Floating Countdown Badge',
    description: `Add a floating countdown badge that remains visible regardless of scroll position. In AlertBanner.tsx or as a new component: (1) When an alert is active and the user scrolls past the alert banner, show a compact floating countdown badge pinned to the top of the viewport (or top of the bottom sheet on mobile), (2) Display the countdown as an animated circular progress ring with the seconds number in the center, (3) The badge should have a "Find Shelter" tap action, (4) Hide the badge when the full AlertBanner is visible in the viewport (use IntersectionObserver), (5) Style with high z-index, compact size (~60px), alert-red color scheme.`,
    files: ['src/components/AlertBanner.tsx', 'src/App.css', 'src/App.tsx'],
    projectRoot
  });

  // Item 20: URL Parameter Validation
  const item20 = await ctx.task(implementItemTask, {
    itemNumber: 20,
    title: 'Add URL Coordinate Validation',
    description: `Add coordinate bounds validation to the shared-route URL parameter parsing in App.tsx lines 66-86. (1) After parsing fromLat/fromLng/toLat/toLng and checking for NaN, add validation that coordinates fall within Israel bounds: latitude 29.0-34.0, longitude 34.0-36.5, (2) If coordinates are out of bounds, ignore the URL params and show the default empty state, (3) Optionally show a brief toast/message that the shared link had invalid coordinates. This is a small but important safety fix.`,
    files: ['src/App.tsx'],
    projectRoot
  });

  // Item 31: State Management Refactor
  const item31 = await ctx.task(implementItemTask, {
    itemNumber: 31,
    title: 'State Management Refactor - Extract Contexts',
    description: `Refactor the heavy prop drilling in App.tsx (28 props to SearchPanel) by extracting state into React Contexts. Create three context providers: (1) src/contexts/RouteContext.tsx - manages route search state: routeInfo, selectedRouteIndex, routesWithShelters, nearbyShelters, sheltersLoading, searchError, isSearching, onSearch, onRouteSelect, (2) src/contexts/EmergencyContext.tsx - manages emergency state: emergencyMode, onEmergencyClick, onExitEmergency, currentLocation, isLoadingLocation, locationError, onGetLocation, (3) src/contexts/ShelterContext.tsx - manages shelter state: selectedShelterId, onShelterClick, capacityMap, shelters. Wrap App contents with these providers. Update SearchPanel and MapView to consume contexts instead of props. Keep the existing functionality identical - this is a refactor only.`,
    files: ['src/contexts/RouteContext.tsx', 'src/contexts/EmergencyContext.tsx', 'src/contexts/ShelterContext.tsx', 'src/App.tsx', 'src/components/SearchPanel.tsx', 'src/components/MapView.tsx'],
    projectRoot
  });

  // Phase 2 Quality Gate
  const phase2QA = await ctx.task(qualityGateTask, {
    phase: 2,
    title: 'Phase 2 Core Experience Quality Gate',
    checks: ['lint', 'typecheck', 'test', 'build'],
    projectRoot
  });

  await ctx.breakpoint({
    question: 'Phase 2 (Core Experience) is complete. Review the implemented improvements. Approve to continue to Phase 3?',
    title: 'Phase 2 Complete - Core Experience',
    context: { runId: ctx.runId }
  });

  // ============================================================================
  // PHASE 3: RELIABILITY & GROWTH FOUNDATION (Items 10, 18, 19, 25, 27, 34)
  // ============================================================================

  ctx.log('info', 'Starting Phase 3: Reliability & Growth Foundation');

  // Item 10: Push Notifications
  const item10 = await ctx.task(implementItemTask, {
    itemNumber: 10,
    title: 'Implement Push Notifications via Service Worker',
    description: `Add Web Push notification support to the service worker so users get alerted even when the app tab is not active. (1) In public/sw.js, add a 'push' event listener that displays a notification with the alert region name and countdown time, (2) Create src/services/pushNotificationService.ts that handles: requesting notification permission, subscribing to push (for now using a local simulation since there's no push server), showing local notifications via the Notification API as a fallback, (3) In useOrefAlerts.ts, when an alert is received and the document is not visible (document.hidden), trigger a local notification using the Notification API, (4) Add a notification permission request to the onboarding flow, (5) Add user preference toggle in settings for notifications. This is a local notification implementation - full Web Push with a server can be added later.`,
    files: ['public/sw.js', 'src/services/pushNotificationService.ts', 'src/hooks/useOrefAlerts.ts', 'src/components/Onboarding.tsx'],
    projectRoot
  });

  // Item 18: Error Reporting
  const item18 = await ctx.task(implementItemTask, {
    itemNumber: 18,
    title: 'Add Basic Error Reporting Service',
    description: `Create a lightweight error reporting service that tracks critical failures. Create src/services/errorReportingService.ts: (1) Track errors in an in-memory buffer (last 50 errors), (2) Categorize errors: 'alert-polling', 'geolocation', 'route-api', 'shelter-load', 'render-error', (3) Log to console in development, (4) Expose getErrorReport() that returns the buffer for debugging, (5) Add a "Debug Info" section to the BugReportForm that auto-includes recent errors, (6) Wire error tracking into: orefAlertService (polling failures), routeService (API failures), shelterApi (load failures), ErrorBoundary (render crashes), useCurrentLocation (geolocation failures). Keep it simple - no external service dependency for now.`,
    files: ['src/services/errorReportingService.ts', 'src/services/orefAlertService.ts', 'src/services/routeService.ts', 'src/services/shelterApi.ts', 'src/components/ErrorBoundary.tsx', 'src/hooks/useCurrentLocation.ts'],
    projectRoot
  });

  // Item 19: Shelter Data Freshness
  const item19 = await ctx.task(implementItemTask, {
    itemNumber: 19,
    title: 'Add Shelter Data Freshness Checks',
    description: `Add staleness detection for shelters.json cache. In src/services/shelterApi.ts: (1) When storing to localStorage, also store a timestamp of when the data was fetched, (2) Add a MAX_CACHE_AGE constant of 30 days, (3) When loading from localStorage cache, check if the cache is older than MAX_CACHE_AGE and if so show a warning in the UI, (4) Add a "Data last updated" timestamp display - create a small component or add to AppHeader showing when shelter data was last refreshed, (5) When fetching shelters.json, check the If-Modified-Since / Last-Modified headers if available, (6) Add translations for "Data updated X days ago" in translations.ts.`,
    files: ['src/services/shelterApi.ts', 'src/components/AppHeader.tsx', 'src/i18n/translations.ts', 'src/App.css'],
    projectRoot
  });

  // Item 25: Arabic Language Support
  const item25 = await ctx.task(implementItemTask, {
    itemNumber: 25,
    title: 'Add Arabic Language Support',
    description: `Add Arabic as a third language option. (1) In src/i18n/translations.ts, add 'ar' translations for all existing keys - Arabic uses RTL like Hebrew so the layout already supports it, (2) Update the Language type to include 'ar': type Language = 'he' | 'en' | 'ar', (3) Update LanguageContext.tsx to support the third language, (4) Update the language toggle in AppHeader.tsx to cycle through he->en->ar->he or show a dropdown with all three, (5) Set document direction to 'rtl' for Arabic (same as Hebrew), (6) Add Arabic names for the OREF alert regions in orefAlertService.ts. Keep translations accurate and natural - use Modern Standard Arabic.`,
    files: ['src/i18n/translations.ts', 'src/i18n/LanguageContext.tsx', 'src/components/AppHeader.tsx', 'src/services/orefAlertService.ts'],
    projectRoot
  });

  // Item 27: Post-Alert Debrief
  const item27 = await ctx.task(implementItemTask, {
    itemNumber: 27,
    title: 'Add Post-Alert Debrief Screen',
    description: `Add a post-alert guidance screen when the countdown expires. In AlertBanner.tsx: (1) When isExpired is true, instead of just showing "expired" text, transition to a "Stay Sheltered" state showing: "Remain in shelter for at least 10 minutes" with a new 10-minute countdown, (2) Add a "I'm Safe" button that dismisses the alert and could be used for future family safety features, (3) Add a "Need Help?" section with emergency hotline numbers: 100 (Police), 101 (Magen David Adom), 102 (Fire), 104 (Home Front Command), (4) Add translations for all new strings, (5) Style with a calmer color scheme (blue/green instead of red) to signal reduced urgency.`,
    files: ['src/components/AlertBanner.tsx', 'src/App.css', 'src/i18n/translations.ts'],
    projectRoot
  });

  // Item 34: Test Infrastructure
  const item34 = await ctx.task(implementItemTask, {
    itemNumber: 34,
    title: 'Improve Test Infrastructure',
    description: `Improve the test infrastructure for better coverage and CI quality gates. (1) Add coverage configuration to vitest.config.ts with thresholds: 60% for services/, 40% for hooks/, (2) Add component test examples: create src/components/__tests__/AlertBanner.test.tsx testing renders, countdown display, button visibility, dismiss behavior, (3) Create src/components/__tests__/ErrorBoundary.test.tsx testing error catching and fallback UI, (4) Update .github/workflows/ci.yml to include coverage reporting step and fail if thresholds are not met, (5) Add a test for the new alertSound.ts utility. Ensure all new and existing tests pass.`,
    files: ['vitest.config.ts', 'src/components/__tests__/AlertBanner.test.tsx', 'src/components/__tests__/ErrorBoundary.test.tsx', 'src/utils/__tests__/alertSound.test.ts', '.github/workflows/ci.yml'],
    projectRoot
  });

  // Phase 3 Quality Gate
  const phase3QA = await ctx.task(qualityGateTask, {
    phase: 3,
    title: 'Phase 3 Reliability Quality Gate',
    checks: ['lint', 'typecheck', 'test', 'build'],
    projectRoot
  });

  await ctx.breakpoint({
    question: 'Phase 3 (Reliability & Growth Foundation) is complete. Review Arabic support, push notifications, error reporting, test infrastructure. Approve to continue to Phase 4?',
    title: 'Phase 3 Complete - Reliability & Growth Foundation',
    context: { runId: ctx.runId }
  });

  // ============================================================================
  // PHASE 4: VIRAL GROWTH FEATURES (Items 21-24, 30)
  // ============================================================================

  ctx.log('info', 'Starting Phase 4: Viral Growth Features');

  // Item 21: My Shelters Saved Locations
  const item21 = await ctx.task(implementItemTask, {
    itemNumber: 21,
    title: 'Implement "My Shelters" Saved Locations',
    description: `Add saved locations feature where users can save Home/Work/School and see pre-computed nearest shelters. (1) Create src/services/savedLocationsService.ts that manages saved locations in localStorage: add/remove/update location, get all locations, pre-compute 5 nearest shelters for each, (2) Create src/hooks/useSavedLocations.ts hook, (3) Create src/components/SavedLocations.tsx showing saved location cards with nearest shelter summary, (4) Add to SearchPanel - show saved locations as quick-select chips above the search inputs, (5) When a saved location is tapped, immediately show its nearest shelters on the map, (6) Add an "Add current location" button to save the user's current position, (7) Add translations for all new strings, (8) Limit to 5 saved locations.`,
    files: ['src/services/savedLocationsService.ts', 'src/hooks/useSavedLocations.ts', 'src/components/SavedLocations.tsx', 'src/components/SearchPanel.tsx', 'src/App.tsx', 'src/i18n/translations.ts', 'src/App.css'],
    projectRoot
  });

  // Item 22: Family Safety Network
  const item22 = await ctx.task(implementItemTask, {
    itemNumber: 22,
    title: 'Implement Family Safety Network (Local Version)',
    description: `Add a family safety network feature - starting with a local/shareable version (no server needed). (1) Create src/services/familySafetyService.ts: generate a unique family group code, store group members in localStorage, manage "I'm Safe" status, (2) Create src/components/FamilySafety.tsx: show family group UI with member list, status indicators, share group link button, (3) The group sharing works via URL parameter ?familyGroup=CODE - when another user opens this link, they join the group locally, (4) Add a "I'm Safe" button that updates the user's status in localStorage (for now - real-time sync would need a backend), (5) During active alerts, show family members' last known status, (6) Add a prominent "Share with Family" button in the app, (7) Note in UI that real-time sync requires internet - this version is for awareness and link sharing. Add translations.`,
    files: ['src/services/familySafetyService.ts', 'src/components/FamilySafety.tsx', 'src/App.tsx', 'src/i18n/translations.ts', 'src/App.css'],
    projectRoot
  });

  // Item 23: Community Shelter Reports
  const item23 = await ctx.task(implementItemTask, {
    itemNumber: 23,
    title: 'Add Community Shelter Reports',
    description: `Add a shelter reporting feature so users can report shelter status. (1) Create src/services/shelterReportsService.ts: store reports in localStorage (per-shelter, with timestamp), get reports for a shelter, aggregate recent reports (last 24h), (2) Create src/components/ShelterReport.tsx: a compact report form with quick-select options: Open/Locked/Crowded/Empty/Damaged/Key Required, (3) In ShelterPopup.tsx, add a "Report Status" button that opens the report form, (4) Show recent report badges on shelter popup and in the shelter list (e.g., "3 reports: Open" as a green badge), (5) In MapView, optionally color-code markers based on recent reports (green=open, red=locked, yellow=crowded, gray=no reports), (6) Reports are anonymous and local-only for now - community sync would need a backend. Add translations.`,
    files: ['src/services/shelterReportsService.ts', 'src/components/ShelterReport.tsx', 'src/components/ShelterPopup.tsx', 'src/components/SearchPanel.tsx', 'src/components/MapView.tsx', 'src/i18n/translations.ts', 'src/App.css'],
    projectRoot
  });

  // Item 24: Shelter Score
  const item24 = await ctx.task(implementItemTask, {
    itemNumber: 24,
    title: 'Implement Shelter Score for Any Address',
    description: `Add a "Shelter Score" feature that grades any address A-F based on shelter accessibility. (1) Create src/services/shelterScoreService.ts: compute score based on: number of shelters within 200m, walking time to nearest shelter, shelter diversity (types), accessibility, alert history frequency for the area. Grade: A (excellent, 4+ shelters <100m), B (good, 2-3 shelters <150m), C (adequate, 1+ shelter <200m), D (poor, shelter >200m), F (critical, no shelter within 400m), (2) Create src/components/ShelterScore.tsx: display the score as a large letter grade with a color (green A through red F), breakdown of factors, and a shareable card view, (3) Add a "Check Shelter Score" option in the search panel that accepts a single address, (4) Add translations. Make the score card visually appealing for social media sharing.`,
    files: ['src/services/shelterScoreService.ts', 'src/components/ShelterScore.tsx', 'src/components/SearchPanel.tsx', 'src/i18n/translations.ts', 'src/App.css'],
    projectRoot
  });

  // Item 30: Rich Share Cards
  const item30 = await ctx.task(implementItemTask, {
    itemNumber: 30,
    title: 'Add Rich Share Cards with OG Meta Tags',
    description: `Improve sharing to generate rich previews on WhatsApp/Telegram. (1) Add Open Graph meta tags to index.html: og:title, og:description, og:image, og:url, og:type, (2) Create a default OG image (as an SVG in public/) showing the app logo and tagline, (3) When sharing a route, update the share URL to include enough info for a meaningful preview: route summary, shelter count, (4) In the share functionality in SearchPanel.tsx, improve the share text to include: "X shelters found on route from A to B" with the app link, (5) For the Shelter Score feature, generate a text-based share card: "My address shelter score: A - 5 shelters within 100m". The full OG image generation would need a server - this implements the client-side sharing improvements.`,
    files: ['index.html', 'src/components/SearchPanel.tsx', 'src/components/ShelterScore.tsx', 'src/i18n/translations.ts'],
    projectRoot
  });

  // Phase 4 Quality Gate
  const phase4QA = await ctx.task(qualityGateTask, {
    phase: 4,
    title: 'Phase 4 Growth Features Quality Gate',
    checks: ['lint', 'typecheck', 'test', 'build'],
    projectRoot
  });

  await ctx.breakpoint({
    question: 'Phase 4 (Viral Growth Features) is complete. Review saved locations, family safety, community reports, shelter score, and sharing improvements. Approve to continue to Phase 5?',
    title: 'Phase 4 Complete - Viral Growth Features',
    context: { runId: ctx.runId }
  });

  // ============================================================================
  // PHASE 5: INTELLIGENCE & POLISH (Items 26, 28, 29, 32, 33)
  // ============================================================================

  ctx.log('info', 'Starting Phase 5: Intelligence & Polish');

  // Item 26: In-App Turn-by-Turn Navigation
  const item26 = await ctx.task(implementItemTask, {
    itemNumber: 26,
    title: 'Add Basic In-App Navigation to Shelter',
    description: `Add basic in-app turn-by-turn-style directions to shelters using ORS route geometry, so users don't need to leave the app. (1) Create src/components/ShelterNavigation.tsx: a compact bottom bar showing step-by-step walking directions to a selected shelter, (2) Use the ORS API to fetch a walking route from user's current location to the shelter, (3) Display instructions: direction arrow based on device compass (DeviceOrientationEvent), distance to next turn, total remaining distance and time, (4) Show the route on the map with a highlighted polyline, (5) Add a pulsing marker on the destination shelter, (6) Add a "Stop Navigation" button to exit, (7) Keep it simple - this is augmented directions, not full turn-by-turn GPS nav. Add translations.`,
    files: ['src/components/ShelterNavigation.tsx', 'src/App.tsx', 'src/App.css', 'src/i18n/translations.ts', 'src/services/routeService.ts'],
    projectRoot
  });

  // Item 28: Personal Safety Dashboard
  const item28 = await ctx.task(implementItemTask, {
    itemNumber: 28,
    title: 'Add Personal Safety Dashboard',
    description: `Create a personal safety dashboard showing safety analytics. (1) Create src/services/safetyAnalyticsService.ts: track and store in localStorage: routes searched, shelters found per route, alerts received, emergency mode activations, average time-to-shelter estimates, (2) Create src/components/SafetyDashboard.tsx: a panel/page showing: "Routes analyzed this week", "Average shelters per route", "Alerts in your area (last 7 days)", "Your shelter coverage score", simple recommendations like "Your Monday commute has fewer shelters - consider this alternative", (3) Add a dashboard icon/tab in the header or as a collapsible section, (4) Visualize data with simple CSS-based charts (bar chart for weekly activity), (5) Add translations. Keep it lightweight and informational.`,
    files: ['src/services/safetyAnalyticsService.ts', 'src/components/SafetyDashboard.tsx', 'src/App.tsx', 'src/i18n/translations.ts', 'src/App.css'],
    projectRoot
  });

  // Item 29: Alert Heat Map
  const item29 = await ctx.task(implementItemTask, {
    itemNumber: 29,
    title: 'Add Alert History Heat Map Layer',
    description: `Add a toggleable heat map layer on the map showing historical alert frequency. (1) The alertHistoryService.ts already fetches and geocodes alert history - extend it to produce heat map data: aggregate alerts by geographic grid cells, count frequency, weight by recency, (2) In MapView.tsx, add a toggle button for "Alert History" layer, (3) When enabled, overlay semi-transparent colored circles on the map: red for frequent recent alerts, orange for moderate, yellow for occasional, (4) Use Leaflet circle markers with appropriate radii based on zoom level, (5) Add a legend showing what colors mean, (6) This should not interfere with shelter markers or route polylines - use lower z-index, (7) Add translations for toggle and legend. Keep performance in mind - use canvas rendering for many markers.`,
    files: ['src/services/alertHistoryService.ts', 'src/components/MapView.tsx', 'src/App.css', 'src/i18n/translations.ts'],
    projectRoot
  });

  // Item 32: Split CSS
  const item32 = await ctx.task(implementItemTask, {
    itemNumber: 32,
    title: 'Split Monolithic CSS into Component Files',
    description: `Split the 2900+ line monolithic App.css into component-level CSS files. (1) Create individual CSS files: SearchPanel.css, MapView.css, AlertBanner.css, ShelterPopup.css, AppHeader.css, EmergencyButton.css, Onboarding.css, ErrorBoundary.css, LocationInput.css, SearchHistory.css, TravelModeSelector.css, and keep App.css for only global styles, CSS variables, and reset/base styles, (2) Move the relevant CSS blocks from App.css to each component file, (3) Import the CSS file in each component (e.g., import './SearchPanel.css' in SearchPanel.tsx), (4) Keep all CSS variables/custom properties in App.css as they are global, (5) Ensure no visual changes - this is a pure refactor. Test that all styles still apply correctly.`,
    files: ['src/App.css', 'src/components/SearchPanel.css', 'src/components/MapView.css', 'src/components/AlertBanner.css', 'src/components/ShelterPopup.css', 'src/components/AppHeader.css'],
    projectRoot
  });

  // Item 33: Optimize Shelter Loading
  const item33 = await ctx.task(implementItemTask, {
    itemNumber: 33,
    title: 'Optimize Shelter Data Loading',
    description: `Optimize the 4.2MB shelters.json loading for faster initial page load. (1) In shelterApi.ts, implement a progressive loading approach: first load shelter data from localStorage cache immediately (already cached from previous visits), then fetch the latest version in the background, (2) Add a loading state that shows the app as functional with cached data while fresh data loads, (3) Implement bounding-box based filtering at fetch time - only parse shelters relevant to the current map viewport initially, then load the rest in the background, (4) Add a web worker for JSON parsing if available (create src/workers/shelterParser.ts as a simple inline worker), (5) Show a progress indicator during initial shelter data download for first-time users, (6) Compress the JSON response with gzip (add to _headers file). Keep backwards compatibility with the existing caching mechanism.`,
    files: ['src/services/shelterApi.ts', 'public/_headers'],
    projectRoot
  });

  // Phase 5 Quality Gate
  const phase5QA = await ctx.task(qualityGateTask, {
    phase: 5,
    title: 'Phase 5 Final Quality Gate',
    checks: ['lint', 'typecheck', 'test', 'build'],
    projectRoot
  });

  // ============================================================================
  // FINAL VERIFICATION
  // ============================================================================

  const finalVerification = await ctx.task(finalVerificationTask, {
    projectRoot,
    totalItems: 34
  });

  return {
    success: true,
    phasesCompleted: 5,
    itemsCompleted: 34,
    verification: finalVerification
  };
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

export const implementItemTask = defineTask('implement-item', (args, taskCtx) => ({
  kind: 'agent',
  title: `Item ${args.itemNumber}: ${args.title}`,
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Senior React/TypeScript developer implementing safety-critical PWA improvements',
      task: `Implement Item ${args.itemNumber}: ${args.title}`,
      context: {
        projectRoot: args.projectRoot,
        files: args.files,
        description: args.description
      },
      instructions: [
        `Read all referenced files first to understand the current code.`,
        `Implement the changes described precisely - do not add extra features or refactoring beyond what is specified.`,
        `Maintain all existing functionality - this is an existing production app.`,
        `Follow existing code patterns and conventions found in the codebase.`,
        `Ensure TypeScript types are correct and there are no type errors.`,
        `Test your changes compile by checking for obvious errors.`,
        `Return a summary of all files modified and what was changed.`
      ],
      outputFormat: 'JSON with fields: { success: boolean, filesModified: string[], summary: string }'
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`
  },
  labels: ['agent', 'implementation', `item-${args.itemNumber}`]
}));

export const qualityGateTask = defineTask('quality-gate', (args, taskCtx) => ({
  kind: 'shell',
  title: `Quality Gate - Phase ${args.phase}`,
  shell: {
    command: `cd ${args.projectRoot} && echo "=== LINT ===" && npm run lint 2>&1 && echo "=== TYPECHECK ===" && npx tsc -b 2>&1 && echo "=== TEST ===" && npm run test:run 2>&1 && echo "=== BUILD ===" && npm run build 2>&1 && echo "ALL CHECKS PASSED"`,
    timeout: 120000
  },
  io: {
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`
  },
  labels: ['shell', 'quality-gate', `phase-${args.phase}`]
}));

export const finalVerificationTask = defineTask('final-verification', (args, taskCtx) => ({
  kind: 'agent',
  title: 'Final Verification - All 34 Items',
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'QA Engineer performing final verification',
      task: 'Verify all 34 plan items have been implemented correctly',
      context: { projectRoot: args.projectRoot, totalItems: args.totalItems },
      instructions: [
        'Run npm run lint, npx tsc -b, npm run test:run, and npm run build.',
        'Check that all new files exist and are properly imported.',
        'Verify the app builds successfully with zero errors.',
        'Report the final status of each verification check.',
        'Return a comprehensive verification report.'
      ],
      outputFormat: 'JSON with fields: { success: boolean, lintPass: boolean, typecheckPass: boolean, testPass: boolean, buildPass: boolean, summary: string }'
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/output.json`
  },
  labels: ['agent', 'verification', 'final']
}));
