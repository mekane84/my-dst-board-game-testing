# Co-op Survival Deck-Builder — Alpha 1.0

A balance-testing prototype of a 2-player cooperative survival deck-building
board game. Survive 10 Days/Nights; Night 10 is always Red Moon.

This is **not** a production video game. It exists so the physical design can be
tuned without reprinting components — correct rules, reproducible seeds, and
useful playtest telemetry matter more than polish.

## Running it

```
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Rule tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run build` | Production build into `dist/` |

## Layout

```
src/engine/      pure JS rules engine — no Vue, no DOM
src/data/        cards, locations, nights, balance constants
src/simulation/  headless policies + batch runner (Phase 11)
src/ui/          Vue components
docs/            design and rules documents — authoritative
prototype-v0/    parked, unrelated prototype (see below)
```

The engine/data/simulation/UI separation is required: the browser UI and the
headless simulator must run the exact same rules. Nothing in `src/engine/` or
`src/data/` may import from Vue or touch the DOM.

## Where the rules live

`docs/ALPHA_1_RULES.md` and `docs/CARDS.md` are authoritative. Where they were
ambiguous, the designer's ruling is recorded inline and marked
`RESOLVED <date>`. `docs/TODO.md` tracks what is still provisional.

If the code and the docs disagree, the docs are right and the code is the bug.

Balance numbers are centralized in `src/data/constants.js`.

## Build status

Phase 1 of `docs/IMPLEMENTATION_PLAN.md` is in progress: seeded RNG, the state
model, deterministic shuffle, and setup. The current UI is a setup harness that
displays what a seed produced — there is no gameplay yet.

## prototype-v0

An unrelated throwaway prototype, kept only as a reference for three ideas that
may be revisited: map movement, limited per-location resources, and forcing a
light source at night. It shares no rules with this game. It has its own
`package.json` and is excluded from this app's tests and builds.
