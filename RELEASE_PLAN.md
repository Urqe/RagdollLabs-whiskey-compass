# Release plan

Release order:
1. **Navigation & Reliability** — maintenance release (R1–R10).
2. **Content Accuracy & Source Traceability** — following release (C1–C11).
3. **Bottle Discovery & Coverage** — wider catalogue, search, and sourced expression notes (B1–B6).

# Maintenance release: Navigation & Reliability

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

## Following release — Content Accuracy & Source Traceability

Status: planned; follows the Navigation & Reliability maintenance release.  
Content review date: 2026-10-19  
Content baseline: `8eb54103d668a0d658a9d281af995d39496b556d` (the subsequent release-plan commit did not change data).

### Goal and sequencing

Ship the maintenance release and complete its release gate first. Then correct factual content, distinguish editorial tasting guidance from established facts, and make supporting sources accessible. These items record review findings and planned verification; they do not imply that content fixes have already shipped. No ranking redesign is required, but corrected category assignments must remain consistent with recommendations and comparison.

### C1. Correct Classic Laddie barley provenance

File: `data/regions-classics-scotland.json`

The bottle note describes Classic Laddie as "Certified unpeated Islay barley". The producer identifies Scottish-grown barley; Islay Barley is a distinct expression.

- [ ] Replace the unsupported Islay-grown/certification claim with expression-specific, producer-supported wording.
- [ ] Verify the precise expression and market/version being described before changing age or cask details.

Acceptance: Classic Laddie and Islay Barley are not conflated, and provenance wording links to the relevant [producer page](https://uk.bruichladdich.com/products/bruichladdich-the-classic-laddie).

### C2. Correct the Japanese whisky standard

File: `data/glossary.json`

The definition requires raw materials to be malted in Japan. The JSLMA standard requires saccharification, fermentation, and distillation in Japan; it does not require Japanese malting or Japanese-grown grain.

- [ ] Correct the production-location requirement.
- [ ] Describe the standard's scope accurately and avoid presenting an industry labeling standard as a universal statutory definition.
- [ ] Check any summarized maturation, bottling, water, and strength requirements against the standard.

Acceptance: The definition follows the [JSLMA English standard](https://www.yoshu.or.jp/files/libs/552/202303291555304944.pdf) and does not imply imported malt is prohibited.

### C3. Verify Rampur Double Cask maturation terminology

File: `data/regions-discovery.json`

The app calls Double Cask sherry-finished. The producer describes a marriage of American bourbon barrels and European oak sherry casks, while separately describing finishing for other expressions.

- [ ] Replace the unsupported sequential finishing description with the producer's supported maturation description, unless expression-specific evidence establishes a finish.
- [ ] Check all related style, effect, and bottle notes for consistent expression names and cask terminology.

Acceptance: Double Cask is not conflated with PX Sherry or other finished Rampur expressions. Use the [producer's Double Cask page](https://rampursinglemalt.com/double-cask/).

### C4. Clarify first-fill terminology

File: `data/taste-basics.json`

"Used for whisky for the first time" is misleading for a first-fill Scotch cask that previously held bourbon, which is itself whiskey.

- [ ] Explain first-fill in its Scotch context as the first Scotch filling after the previous contents.
- [ ] Distinguish first-fill, refill, and virgin oak.

Acceptance: The explanation accommodates ex-bourbon first-fill casks without contradiction. Supporting reference: [The Glenlivet's cask guide](https://www.theglenlivet.com/en/our-community/articles/used-casks-in-whisky/).

### C5. Correct sour-mash backset provenance

File: `data/glossary.json`

The definition places the reused acidic material at the previous fermentation stage. Backset is liquid remaining after distillation.

- [ ] Correct the process description and review any linked explanation for the same error.

Acceptance: The glossary correctly identifies post-distillation backset, consistent with [Heaven Hill's distillery explanation](https://heavenhilldistillery.com/bernheim-distillery-3d-tour/).

### C6. Correct and qualify Speyside cask generalizations

File: `data/regions-classics-scotland.json`

The Benromach profile's method omits sherry casks, although the producer specifies first-fill bourbon and sherry maturation. The broader unpeated Speyside description says mostly refill ex-bourbon without establishing that claim for its examples; Glenfiddich 12 uses bourbon and Oloroso sherry casks.

- [ ] Correct Benromach's maturation description.
- [ ] Qualify broad regional cask statements and ensure examples do not silently contradict them.
- [ ] Review bottle notes and style summaries together.

Acceptance: Cask claims align with [Benromach 10](https://www.benromach.com/whisky/aged-10-years) and [Glenfiddich 12](https://shop.us.glenfiddich.com/products/glenfiddich-12-year-old); regional tendencies are clearly presented as tendencies.

### C7. Resolve category/example contradictions

Files: `data/regions-world.json`, `data/regions-discovery.json`, affected model/rendering code if needed

Lot No. 40 is presented under a Canadian blended profile even though its own note says it is not a blend. Sweden's single lightly peated profile includes unpeated Älv, lightly peated Hav, and peated Timmer.

- [ ] Choose suitable profiles or explicitly model bottle-specific exceptions instead of assigning all examples the same categorical claims.
- [ ] Audit smoke explanations and comparisons affected by these assignments.
- [ ] Preserve valid profile references if entries move.

Acceptance: Canadian blending and Swedish peat claims match the specific expressions; no explanation infers peat merely from geography or from an unsuitable shared profile. References: [Lot No. 40 producer](https://www.pernod-ricard.com/en/brands/lot-no-40), [Timmer](https://www.highcoastwhisky.se/en/products/timmer), and [Älv](https://www.highcoastwhisky.se/en/products/alv).

### C8. Rework unsupported maturity claims

File: `data/maturity.json`

Precise age brackets and causal statements currently lack sources. Examples include oak receding in Japanese whisky at 18+ years and pot-still whisky gaining sherry depth with age. NAS also does not establish that a whisky is young.

- [ ] Audit every age bracket and maturation claim.
- [ ] Remove unsupported precision or clearly label illustrative editorial guidance.
- [ ] Distinguish age effects from cask selection, climate, blending, and expression-specific recipes.
- [ ] Do not use NAS as evidence of youth.
- [ ] Add sources for factual maturation claims.

Acceptance: Age alone does not promise a flavor or sherry influence; illustrative brackets are not presented as universal thresholds, and supported facts have accessible references.

### C9. Qualify coastal maturation explanations

Files: regional JSON data, especially `data/regions-classics-scotland.json`

Claims that coastal maturation adds salinity or that Skye's exposed maturation intensifies pepper and smoke are stronger than the available evidence. Coastal tasting descriptors do not by themselves establish that mechanism.

- [ ] Audit geographic flavor-causation claims throughout the data.
- [ ] Retain useful sensory descriptions while removing or qualifying unsupported causal explanations.
- [ ] Attribute producer interpretations where appropriate and acknowledge uncertainty when evidence conflicts.

Acceptance: Salty, maritime, and peppery tasting notes are distinguished from demonstrated causes. Evaluate conflicting claims rather than treating marketing copy as proof; see the [SMWS discussion of coastal salinity](https://www.smws.ch/en/oily-coastal/).

### C10. Update or explicitly date Glenmorangie Original references

File: `data/regions-classics-scotland.json`

The current-looking example names The Original 10; the flagship changed to 12 years in 2024. The historical 10-year expression remains a valid reference if identified as such.

- [ ] Choose whether the example represents the current flagship or the historical bottling.
- [ ] Update its age, name, notes, and source consistently, or mark it as historical.
- [ ] Check other named expressions for similar version drift.

Acceptance: Readers can identify the intended bottling. Current reference: [Glenmorangie The Original 12](https://www.glenmorangie.com/products/the-original-12-years-old).

### C11. Improve source coverage and visibility

Files: `data/sources.json`, `data/production.json`, `data/maturity.json`, `data/glossary.json`, `data/taste-basics.json`, relevant learning and enrichment renderers

At review, 28 of 73 source records pointed to root homepages. Production content relied on a broad SWA reference, maturity had no sources, and some guide/glossary source IDs were not displayed to readers. A real organization or homepage does not establish every nearby claim.

- [ ] Replace generic homepage references with specific supporting pages where available.
- [ ] Map factual claims to sources at a useful content-unit level.
- [ ] Display references in learning and enrichment sections, not only profile sources.
- [ ] Prefer producers for expression details and standards bodies for definitions; use appropriate technical evidence for causal claims.
- [ ] Label subjective tasting scores and editorial guidance clearly.
- [ ] Record verification dates for changeable expression details.
- [ ] Preserve strict outbound URL validation.

Acceptance: Readers can reach evidence for factual claims from the relevant content; references support the actual wording, and unsupported claims are qualified or removed.

### Content release gate

- [ ] Resolve C1–C11 and review the final wording against the cited sources.
- [ ] Recheck sources at implementation time; product pages and expression versions can change.
- [ ] Run `npm run validate` successfully after data and rendering changes.
- [ ] Add focused regression coverage where category/model behavior or source rendering changes.
- [ ] Check that moved profiles preserve navigation, recommendations, comparisons, and featured cards.
- [ ] Manually verify reference visibility and usable links on mobile and desktop.
- [ ] Confirm editorial tasting judgments are distinguishable from legal definitions, production facts, and causal explanations.
- [ ] Publish release notes identifying factual corrections and any changes to profile categorization.

Review limit: This is a targeted content audit, not certification of every whiskey claim. Unsupported claims are not automatically false, and tasting descriptors remain partly subjective.

## Third release — Bottle Discovery & Coverage

Status: planned; follows Content Accuracy & Source Traceability.  
Plan date: 2026-10-19

### Goal and scope

Help visitors find bottles they already know, understand how those expressions relate to the app's style profiles, and discover relevant alternatives. Expand the catalogue incrementally with sourced records. Complete the preceding releases' gates first and reuse their corrected profiles, source presentation, and navigation behavior.

### B1. Separate brands from bottle expressions

- [ ] Introduce stable brand and expression identities in static data, reusing the existing source registry.
- [ ] Store expression names, brand references, search aliases, relevant bottling/version details, source references, verification dates, and explicit profile coverage.
- [ ] Keep brand descriptions about the producer's range; attach flavor distinctions to individual expressions.
- [ ] Migrate existing notable bottles into the shared catalogue without duplicate records or losing curated placement.
- [ ] Define a manageable initial catalogue and expand only as entries meet the editorial requirements below.

Acceptance: Searching a brand can reveal its individual expressions without assigning the brand a single flavor profile. Existing notable bottles remain accessible, and catalogue entries have unique identities and valid references.

### B2. Extend search to the wider catalogue

- [ ] Match brand names, expression names, aliases, and curated common spelling variants.
- [ ] Normalize case, accents, and punctuation while preserving proper display names.
- [ ] Present the matched bottle explicitly, with enough information to distinguish similar names or versions.
- [ ] Link covered expressions to the relevant profile and keep the matched bottle identifiable when navigating there.
- [ ] Keep exact expression matches prominent, deduplicate results, and retain existing region/style search.
- [ ] Make empty results and unsupported-profile results understandable.

Acceptance: Exact names, brand queries, and representative aliases find the intended entries on mobile and desktop. A bottle match does not silently become a claim that its flavor exactly matches the profile.

### B3. Add discreet catalogue browsing

- [ ] Keep the curated notable bottles visible by default.
- [ ] Add a small "See more bottles" control beneath them, revealing an alphabetical list of additional expressions relevant to that profile.
- [ ] Provide a separate "Browse all brands" entry to an alphabetical brand directory, with access to each brand's expressions.
- [ ] Use semantic buttons for disclosure and links for navigation; expose expanded state and preserve keyboard focus.
- [ ] Keep the directory usable on iPhone/iPad and desktop without overwhelming the profile page.
- [ ] If browsing creates a separate view, integrate it with the existing route/history model and restore useful context when returning.

Acceptance: The contextual list stays relevant to its profile; the brand directory exposes the broader catalogue. Touch, keyboard, and screen-reader users can open, browse, and leave either surface predictably.

### B4. Add optional expression-to-profile notes

- [ ] Store one short, curated sentence describing a meaningful fit or difference beneath each expression where evidence supports it.
- [ ] Tie each comparative note to its specific profile so that reassignment or profile changes trigger editorial review.
- [ ] Prefer wording such as "Less smoky than this profile suggests; more fruit-forward" over an undefined "less smoky than typical".
- [ ] Label these comparisons as editorial interpretations supported by linked reviews.
- [ ] Omit a note when there is no useful, defensible distinction; do not force every bottle to have one.
- [ ] Do not generate notes from review scores or infer bottle-level flavor measurements from profile scores.
- [ ] Keep supporting references accessible without making the short note visually intrusive.

Illustrative wording only, not claims about named bottles:
- "Less smoky than this profile suggests; more fruit-forward."
- "A richer, more sherry-led example of this style."
- "Close to the profile, with a lighter body and shorter finish."

Acceptance: Each published comparison has relevant supporting evidence and an identifiable comparison profile. Readers can distinguish bottle facts, reviewer impressions, and the app's editorial interpretation. Brand-level text does not imply that all expressions taste alike.

### B5. Apply a claim-specific sourcing policy

Use the source suited to the claim:

| Claim | Preferred evidence |
| --- | --- |
| Age, ABV, ingredients, casks, origin | Producer documentation for the exact expression/version |
| Labeling definitions | Applicable standards body or regulator |
| Smoke, sweetness, body, finish | Established reviewers; preferably two independent accounts |
| Difference from an app profile | Editorial synthesis of relevant reviews against the defined profile |
| Production method causing a flavor | Appropriate technical evidence beyond tasting impressions |

- [ ] Assess reviewers by named authorship, transparent tasting methods, sample/commercial disclosures, expression identification, and useful publication dates.
- [ ] Treat Whisky Magazine, Whisky Advocate, and Whiskyfun as starting candidates, not automatic approval of every claim on their sites.
- [ ] Prefer agreement between independent reviews for comparative notes; duplicated producer copy does not count as independent corroboration.
- [ ] Retain review links, author/publication details where available, review dates, verification dates, and relevant bottling/version information.
- [ ] Separate a source's observations from the app's inference: "gentle smoke" alone does not establish "less smoky than typical".
- [ ] Qualify, attribute, or omit conclusions when reliable accounts conflict or evidence is thin.
- [ ] Summarize in original wording and link to the specific supporting review.
- [ ] Keep ratings out of flavor measurements; an overall quality score does not measure sweetness, smoke, or body.
- [ ] Recheck notes when expressions, bottlings, or the underlying profile change.

Methodology references to verify during implementation:
- [Whisky Magazine blind tasting overview](https://www.whiskymag.com/articles/the-top-rated-whiskies-from-whisky-magazine-issue-205/)
- [Whisky Advocate Buying Guide methodology, Winter 2025](https://mydigitalpublication.com/publication/?article_id=5090207&i=858619&view=articleBrowser)
- [Whiskyfun tasting FAQ](https://www.whiskyfun.com/faq.html)
- [Whiskyfun disclosures](https://www.whiskyfun.com/FTC-disclosure.html)

Acceptance: References substantiate the exact published wording and match the expression being described. Subjective impressions remain visibly distinct from established production facts.

### B6. Make coverage gaps explicit and actionable

- [ ] Allow sourced catalogue entries without a suitable existing profile.
- [ ] Show basic expression information and "Profile not yet covered" for those entries.
- [ ] Do not force unmatched expressions into a nearby geographic/style profile or give them inherited comparison scores.
- [ ] Build a documented backlog from catalogue entries lacking suitable coverage, recording the missing style/region and supporting evidence.
- [ ] Prioritize later profile additions by meaningful flavor or production distinctions and usefulness for discovery.
- [ ] Keep future region/style expansion as a separately scoped release; a longer directory alone is not evidence that the model needs more profiles.

Acceptance: Uncovered expressions remain searchable without misleading recommendations or broken links. The backlog explains what is missing and why an addition would improve the app.

### Bottle discovery release gate

- [ ] Validate brand/expression uniqueness, aliases, source references, profile references, and explicit uncovered states.
- [ ] Run `npm run validate` and add focused search, disclosure, navigation, and coverage regression checks.
- [ ] Verify representative exact names, brand searches, spelling variants, accented names, and duplicate-name/version cases.
- [ ] Verify unsupported entries never inherit an unsuitable profile or its scores.
- [ ] Review every new factual claim and comparative note against its expression-specific evidence.
- [ ] Check mobile Safari, desktop keyboard/mouse, focus restoration, and screen-reader disclosure behavior.
- [ ] Measure search responsiveness and initial loading with the expanded catalogue; retain static deployment.
- [ ] Confirm existing curated examples, profile browsing, recommendations, and Compare still work.
- [ ] Publish the catalogue scope and any known coverage gaps without implying an exhaustive directory.
