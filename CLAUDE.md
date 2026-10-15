# CLAUDE.md — Project Instructions

**This is a living document.** When a decision changes what the best plan is,
update this file as part of that work rather than leaving it contradicted.
Record rule rulings in `docs/` (see "Rules authority" below), not here.

## Primary objective

Build a **balance-testing prototype** of a cooperative survival deck-building
game — Alpha 1.0, 2 players, 10 Days/Nights. This is not a production video
game. Rules correctness, deterministic reproducibility, and useful playtest
telemetry matter more than visual polish.

## Repository layout

```text
/                 Alpha 1.0 — the real game
docs/             design + rules documents (authoritative)
prototype-v0/     parked throwaway prototype, NOT this game
```

`prototype-v0/` is a separate Vue app with its own `package.json`, kept only as
a reference for three ideas that may be revisited later: map movement, limited
per-location resources, and forcing a light source at night. **Never port its
rules, balance numbers, or mechanics into Alpha 1.0 without being asked.**

## Rules authority

`docs/ALPHA_1_RULES.md` and `docs/CARDS.md` are authoritative. Where they are
ambiguous, the resolution is recorded inline and marked `RESOLVED <date>`.

1. **Never silently change a game rule.** If a rule seems awkward,
   contradictory, unbalanced, or hard to implement, preserve it and flag it to
   the designer.
2. Rules marked `PROVISIONAL` may change later; implement the documented alpha
   default now and keep it in data/config.
3. When the designer rules on an ambiguity, **write it into the relevant doc**
   with a `RESOLVED <date>` marker so the spec and the code stay in sync.

## Non-negotiable constraints

1. **Game engine must be UI-independent.**
   - Plain JavaScript in `src/engine/`, importing nothing from Vue or the DOM.
   - The browser UI and the automated simulator must call the same engine.
   - This is the constraint that matters; see "Stack" for why it is not TypeScript.

2. **All randomness must be deterministic from a seed.**
   - A seed must reproduce deck shuffles, draws, and every random outcome exactly.
   - Show the seed in the UI; allow starting a new game from an entered seed.
   - RNG state must be serializable so a full state export round-trips.

3. **Everything important must be data-driven.**
   - Card names, costs, effects/parameters, deck composition, and Night
     thresholds live in `src/data/`, not scattered through UI code.
   - Hard-coded effect handlers are fine, but cards reference effect IDs/params.

4. **Write tests while implementing.**
   - Vitest. Every major rule gets at least one test.
   - Especially: deck cycling, Gear replacement draws, Fear clogging, 2-use
     durability, food-source cooldowns, Fire Pit fueling, Night thresholds,
     Red Moon, Hunger-at-0 conversion, and seeded reproducibility.

5. **Preserve a complete action/event log.**
   - Every draw, resource change, craft, damage, Fear gain/removal, Gear
     use/break, harvest/cooldown, Night outcome, and shuffle is logged.
   - Exportable as JSON and as human-readable text.

6. **Keep balance constants centralized** in `src/data/constants.js`.

7. **No networking for Alpha 1.0.** Local hotseat, plus a developer mode where
   one tester controls both players with both hands visible.

8. **Do not add content outside the frozen scope.** No Gold, Science Machine,
   character powers, personal quests, Crock Pot, Drying Rack, advanced farming,
   resurrection, or extra seasons/biomes. No 4–6 player scaling beyond keeping
   `playerCount` structurally configurable where it is easy.

## Stack

**Vue 3 + JavaScript + Vite.** Vitest for tests.

The original handoff specified React + TypeScript. The designer chose Vue 3 +
JavaScript instead, deliberately, to match the rest of the repo and his own
familiarity. The substantive requirement behind the original wording — a game
engine that is fully UI-independent and callable headlessly — is unchanged and
still mandatory. Use JSDoc on engine types where it aids clarity.

## Architecture

```text
src/
  engine/      pure JS rules engine — no Vue, no DOM
  data/        cards, locations, nights, constants
  simulation/  headless policies + batch runner
  ui/          Vue components
```

The separation of **engine / data / simulation / UI** is required. Authoritative
rules must never live in a Vue component.

Prefer explicit state transitions:

```js
const { state, events } = applyAction(state, action, rng)
```

## Hotseat secrecy

In normal 2-player mode: Player 1 sees only their own hand while selecting, locks
it, a pass-screen hides it, Player 2 selects, then both reveal simultaneously and
the team picks the resolution order. Repeat for each of the three action rounds.

Shared resources, Camp, Locations, the Night card, Health/Hunger, and public Gear
state may always be shown openly.

## Developer-mode conveniences

Undo, manual state editing, force-draw and deck inspection are developer-mode
only. Always available: copy/export seed, export state JSON, export event log,
and "restart same seed".

## Definition of done for Alpha 1.0

A tester can:

1. Start a seeded 2-player game.
2. Play all 10 Days through hotseat action selection.
3. Draw/cycle decks correctly including Fear and Gear.
4. Explore Locations and use Location Gather actions.
5. Craft, use, and break personal Gear.
6. Build and use Camp Improvements and food infrastructure.
7. Manage Food/Hunger/Health/Fear.
8. Resolve all Early/Mid/Late Nights and Red Moon.
9. Win or lose according to the rules.
10. Export a reproducible log/state.
11. Run automated simulated games through the same engine.

## Working agreement

- **Do not `git commit` or `git push`.** Leave work uncommitted for review.
- Build in small vertical slices; keep tests green after each.
- A phase is not "done" until the designer has tested it.
- **Do not propose balance tweaks until the game is playable end to end.**
  Rules questions and genuine ambiguities are always worth raising; opinions
  about costs and yields wait until there is something to play and simulate.
