# RagDollLabs Whiskey Compass

A static, data-driven whiskey reference app for exploring how style family, region and
production shape a whiskey's character. Companion to the
[RagDollLabs Wine Atlas](https://github.com/Urqe/RagdollLabs-wine-atlas), reusing its
architecture with a whiskey-domain model.

Live site: https://urqe.github.io/RagdollLabs-whiskey-compass/

## Brand naming

The visible product brand is **RagDollLabs Whiskey Compass**. The **Compass** name reflects
the app's signature discovery navigation: mood-first exploration ("Smoky & briny",
"Sweet & sherried") pointing you toward the right regional style.

The small **RagDollLabs reference tools** kicker keeps one typeface and one word, but visually
separates **RagDoll** in a light cream tone from **Labs** in gold so the three adjacent
`L` letterforms do not visually collapse together.

## Whisky vs whiskey

Scotland, Japan and Canada write *whisky*; Ireland and the USA write *whiskey*. The app uses
"whiskey" as its global default in its own name and UI, and follows each region's convention
inside that region's copy. The glossary explains the convention.

## Features

- **Welcome experience** — first-time visitors start from a minimal landing page
- **Three entry paths** — explore by style family or place, search, or surprise me
- **Style families and peat levels** — expressions are separated by production
  peating (unpeated, lightly peated, heavily peated) and cask influence;
  every profile declares its phenol classification explicitly
- **How to drink it** — whiskey-native serving guidance per profile: water & ABV
  dilution, ice & highball suitability, glassware
- **Country → Region → Style hierarchy** — Scotland (Islay, Speyside, Highlands, Lowlands,
  Campbeltown, Islands), USA (Kentucky, Tennessee), Ireland, Japan, Canada, plus emerging
  India, Taiwan and England
- **Sensory profile** — body, peat & smoke, sweetness, spice, fruit, oak, finish length and
  ABV feel on a 0–5 editorial scale, explicitly disclosed as comparative judgement
- **Notable bottles** — each regional profile carries curated example bottles
  (Laphroaig 10, Macallan 12 Sherry Oak, Elijah Craig…) with a one-line character note.
  No prices or scores: they rot; character notes don't
- **Mood-first discovery** — Light & delicate, Big & rich, Smoky & briny, Sweet & sherried,
  Spicy & bold, Something unusual
- **Why does it taste like this?** — explicit cause → effect explanations connecting peat,
  mashbill, casks and climate to flavor
- **Production choices** — cask and process alternatives with prevalence and taste impact
- **Age & maturation evolution** — how age statements change selected styles
- **Learning layer & glossary** — peat, phenol ppm, angel's share, bottled in bond,
  mizunara oak, worm tubs, chill filtration…
- **Whiskey-appropriate pairings** — chocolate, cheese, BBQ, smoked fish: intensity-matched
  rather than wine-style acid matching
- **Compare mode** — comparison-group matching with "What sets them apart"
  flavor-language differences; Japanese and Indian malts never labelled Scotch
- **Recommendations in flavor language** — "If you like this, try" describes
  what you'll taste, derived from the expressions' actual scores, never geography
- **Sourcing & governance** — every region carries at least two credible sources;
  profile-level citations validated against sources.json; producer product pages
  for specific claims; editorial vs sourced facts kept distinct; validation
  rejects absolute serving directives and out-of-range combined scores
- **Locator maps** — local SVG maps, no tile service or tracking

## Data model

Profiles are **style family × region expressions** (like the wine atlas's grape × region),
defined in `data/`:

- `styles.json` — style families with base sensory metrics
- `regions-classics-scotland.json`, `regions-classics-world.json`, `regions-discovery.json` —
  regional profiles with mods, notes, serve guidance, pairings, why-rules, identity and bottles
- `glossary.json`, `why-rules.json`, `maturity.json`, `production.json` (production choices),
  `whiskey-search.json`, `food-aliases.json`, `food-dishes.json`, `locators.json`, `sources.json`

## Development

No build step. Static files served from the repo root.

```bash
npm install
npm run validate   # syntax + data schema + DOM smoke tests
```

Deploy via GitHub Pages from the default branch.

## Design notes

- **Regions-first with a bottle layer**: profiles describe regional styles; bottles are
  educational exemplars attached to profiles, not primary entities
- **Whiskey-dark theme**: oak/charcoal backgrounds, copper/amber accents, cream text —
  the deliberate visual differentiator from the wine atlas's wine tones
- **Mood-first discovery**: people choose whiskey by flavor mood more than by food pairing;
  food search remains available but secondary
- Data and behavior are separated: all whiskey knowledge lives in `data/*.json`, all
  behavior in vanilla ES modules with no framework or bundler
