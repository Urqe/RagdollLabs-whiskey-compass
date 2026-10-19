# Next release plan: Navigation & Reliability

Status: planned  
Plan date: 2026-10-19  
Review baseline: `8eb54103d668a0d658a9d281af995d39496b556d`

## Goal and scope

Make navigation predictable, restore a meaningful green validation suite, preserve keyboard focus, and remove confirmed maintenance debt. Prioritize the iPhone/iPad experience while retaining desktop keyboard and mouse support.

This is a reliability and maintenance release. No new whiskey content, ranking redesign, or visual redesign is required. This document records planned work; its checkboxes do not imply implementation or verification.

## Priority 1 — Restore trustworthy validation

### R1. Replace ranking-dependent smoke assertions

Files: `tests/dom-smoke.mjs`, `smart-discovery.js`, `app.js`

The current smoke suite requires an Islay recommendation from unpeated Lowlands, Speyside, and Highlands. Smart Discovery selects three discovery intents, so a particular destination is not guaranteed. Lowlands currently recommends Wales, Ireland, and England.

- [ ] Replace destination-specific assertions with deterministic checks of the explanation logic using explicit unpeated source/candidate pairs.
- [ ] Preserve the original safety requirement: unpeated Islay must not be described as smoky merely because it is from Islay.
- [ ] Check the actual rendered recommendations for valid profile references, uniqueness, and explanations consistent with their scores.
- [ ] Do not change recommendation rankings solely to satisfy an obsolete assertion.

Acceptance:
- `npm run validate` passes without skipping or deleting the underlying smoke-claim regression.
- The regression fails if geography-based smoke wording is deliberately introduced.
- Hardening and validator-integrity checks run through the standard validation command.

## Priority 2 — Fix navigation and workspace state

### R2. Make gallery entry an explicit, exclusive view transition

Files: `gallery.js`, `app.js`, `ux.js`, `home-brand.js`

Reproduction: open Compare, return home, then choose "Browse the whole map". The gallery and comparison remain visible together, with Compare controls still active.

- [ ] Give gallery entry a consistent transition that hides Explore, Compare, and the empty state.
- [ ] Synchronize visible controls and mode indicators with the gallery state.
- [ ] Preserve comparison selections when leaving the workspace.
- [ ] Define gallery URL/history state instead of retaining a previously selected profile URL.
- [ ] Restore the gallery when Back is pressed after opening one of its profiles.
- [ ] Keep transitions coordinated through the existing application API/events; avoid adding another independent collection of visibility flags.

Acceptance:
- Compare → home → gallery shows only the gallery in the main content area.
- Profile → gallery does not leave the profile's route identifying the gallery.
- Gallery → profile → Back restores the gallery; Forward restores the selected profile.
- Home, Explore, Compare, and gallery transitions remain consistent after repeated navigation.
- Returning to Compare retains its selections.

### R3. Avoid duplicate history entries during initial route hydration

Files: `app.js` (`applyInitialRoute`, `selectProfile`, `updateUrl`, `popstate`)

Opening a valid shared profile calls `pushState` for the URL already open, creating a duplicate entry before the user navigates.

- [ ] Distinguish initial hydration, user navigation, and history restoration.
- [ ] Hydrate a valid initial route without pushing a duplicate entry; use `replaceState` if state metadata needs initialization.
- [ ] Ensure Back/Forward restoration never creates a new history entry, including welcome and invalid-route handling.
- [ ] Keep real profile changes as navigable history entries.
- [ ] Remove the unused `applyCurrentRoute` helper or consolidate it into routing only if it preserves all view and history behavior.

Acceptance:
- A shared profile opens without increasing history length.
- Back from a newly opened shared link does not first visit an identical app-created entry.
- Profile A → profile B → Back → Forward restores A and B without growing history.
- Welcome, gallery, and invalid routes behave consistently.

## Priority 3 — Preserve keyboard and assistive-technology navigation

### R4. Preserve focus when comparison results change

Files: `compare-discovery.js`, `advanced-compare.js`

Adding a candidate rebuilds the result list and removes the focused Add button. Focus currently drops to the document body.

- [ ] Update existing result rows where practical, or explicitly restore focus after rendering.
- [ ] When Add becomes disabled, move focus to a sensible next available action rather than the disabled replacement.
- [ ] Handle focus deliberately when removing comparison cards or clearing slots.
- [ ] Provide concise status announcements for additions/removals without repeatedly announcing the whole result list.

Acceptance:
- Keyboard activation of Add does not drop focus to the body or a hidden element.
- Users can add multiple candidates and remove selections without restarting tab navigation.
- Full comparisons and empty result sets retain a usable focus destination.
- Pointer and touch interactions continue to work normally.

### R5. Make the slash shortcut workspace-aware

File: `app.js` (global keydown handler)

The shortcut always targets Explore search, which is hidden in Compare.

- [ ] Focus `compareDiscoveryInput` in Compare and `searchInput` when Explore search is visible.
- [ ] Define behavior on welcome and gallery; never focus a hidden control.
- [ ] Preserve typing, editable-content, and modifier-key exclusions.
- [ ] Avoid stealing shortcuts while a modal dialog is open.

Acceptance:
- `/` focuses the visible search for the active workspace.
- Typing in inputs, selects, textareas, or editable content is unaffected.
- Shortcut behavior does not move focus outside an open modal.

## Priority 4 — Targeted maintenance

### R6. Remove confirmed leftovers and clarify intentional guards

Files: `app.js`, `advanced-compare.js`, `smart-discovery.js`, `compare-state.js`, `maturity.js`

- [ ] Delete the unused `profileSources` calculation.
- [ ] Delete unused `advancedCompatibilityLabel`.
- [ ] Remove the redundant `compatible = candidates` alias and obsolete compatibility wording where any-vs-any comparison is now the policy.
- [ ] Simplify the `biggestOnly` conditional while preserving boolean normalization and existing reset semantics.
- [ ] Keep the maturity section/wrapper guard intentionally, or simplify it only with a clear structural contract. It is not a confirmed behavior bug.
- [ ] Remove other directly related unused locals discovered during these edits.

Acceptance:
- Selection deduplication, slot promotion, and concise-mode behavior remain unchanged.
- Maturity stays hidden for profiles without enrichment and displays correctly for supported profiles.

### R7. Preserve fallback resilience and reduce explanation drift

Files: `app.js`, `smart-discovery.js`, `compare-country.js`, `tests/harness.mjs`, relevant tests

The legacy comparison is not wholly dead: it runs during startup before enhancement initialization and remains usable when Advanced Compare is omitted. Recommendation fallback also works without Smart Discovery.

- [ ] Retain the fallback policy for this release.
- [ ] Add focused tests that omit enhancement scripts and verify usable legacy comparison and recommendations.
- [ ] Correct comments that imply dedicated fallback regression coverage where none exists.
- [ ] Share score-derived explanation primitives where useful, while retaining intentional differences between Smart Discovery and fallback ranking.
- [ ] Do not delete the fallback stacks as routine dead-code cleanup.

Acceptance:
- Core browsing works with the relevant enhancement scripts omitted.
- Both recommendation paths avoid unsupported geography/ingredient claims.
- Normal startup does not leave duplicate legacy and enhanced controls visible.

### R8. Store featured cards as cohesive records

File: `ux.js` (`renderFeaturedDiscoveries`)

- [ ] Replace parallel picks/cues arrays and positional lookup with records containing `styleId`, `regionId`, and `cue`.
- [ ] Keep invalid-profile omission behavior.
- [ ] Use a data file only if it materially improves editorial maintenance; another request is not required for three records.

Acceptance:
- Reordering a record cannot attach another profile's tasting cue.
- Current card content and navigation remain correct.

### R9. Improve shared rendering utilities without a broad rewrite

Files: `dom-utils.js`, `app.js`, `advanced-compare.js`

- [ ] Put HTML text/ordinary-attribute encoding behind a shared utility rather than making Advanced Compare depend on the core application for it.
- [ ] Preserve the encoder's documented limits: it is not a URL, CSS, JavaScript, or general HTML sanitizer.
- [ ] Prefer DOM construction/textContent for new or materially changed UI.
- [ ] Retain strict reference URL validation and numeric bounds for chart widths.
- [ ] Avoid a wholesale template conversion in this release.

Acceptance:
- Existing injection and reference-URL hardening checks pass.
- Updated modules do not introduce unescaped dynamic HTML or unsafe URL contexts.

### R10. Make cache-version maintenance less error-prone

Files: `index.html`, `data-loader.js`, CSS asset references, release tooling/documentation

Different code/data tokens are not by themselves a caching defect. The risk is forgetting a required update during deployment.

- [ ] Provide a small release helper or validation check for the existing versioning strategy.
- [ ] Cover HTML-linked assets, data URLs, and versioned CSS asset references.
- [ ] Either generate tokens together or document and check the intended independent invalidation policy.
- [ ] Keep the site deployable as a static GitHub Pages application without adding a large build framework.

Acceptance:
- The release process has an explicit, repeatable way to update relevant cache keys.
- Fresh loads request the intended asset/data versions after deployment.
- Versioning rules are documented accurately.

## Verification and release gate

Automated:
- [ ] Run `npm run validate` successfully from a clean dependency installation.
- [ ] Add regression coverage for R1–R5 and focused fallback coverage for R7.
- [ ] Confirm production changes do not weaken existing data, escaping, or URL-policy checks.

Manual:
- [ ] Check iPhone Safari and iPad Safari: welcome, shared links, gallery, profile selection, Compare, Back/Forward, and home navigation.
- [ ] Check desktop mouse and keyboard flows, including Add/Remove, search, `/`, and modal focus.
- [ ] Confirm focus and scroll position orient users after view transitions.
- [ ] Check status announcements with VoiceOver, including repeated messages.
- [ ] Verify the published GitHub Pages site after deployment, including cache refresh behavior.

Do not replace the current `announce()` timing technique solely on the assumption that another DOM pattern is more reliable. Change it if assistive-technology testing demonstrates a defect, then verify the replacement.

## Review evidence and limits

At the review baseline, syntax, CSS integrity, data validation, hardening, and validator-integrity checks passed. Standard validation failed at the ranking-dependent Islay assertion. The remaining smoke tests passed when that obsolete assertion block was excluded in memory for diagnosis; this was not a fix.

Navigation and focus findings were reproduced through DOM execution. Native Safari layout, touch behavior, and screen-reader behavior still require the manual checks above. No GitHub Actions workflow was present in the reviewed snapshot, so the known failure is local validation rather than a verified CI run failure.
