# The Constant — board game playtest build

A digital prototype of a Don't Starve themed board game. The point isn't to
ship a video game; it's to tune the board game without reprinting cards every
time a number changes.

Survive 20 days. Manage health, hunger and sanity across a day/dusk/night
cycle, gather from a 7x7 board, craft light before the dark finds you.

## Running it

```
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm test` | Rule tests (29 of them) |
| `npm run test:watch` | Tests in watch mode |
| `npm run sim` | Play 500 games headlessly, print the difficulty curve |
| `npm run build` | Production build into `dist/` |

Every push to `main` deploys to GitHub Pages, so playtesters get a link
instead of a build step.

## How this is laid out

```
src/game/      the rules engine — pure JS, no Vue, no DOM
  rules.js       every tunable number
  engine.js      state, actions, upkeep, win/loss
  map.js         board generation
  rng.js         seeded randomness
  simulate.js    the balance bot
src/stores/    thin Pinia bridge between engine and UI
src/components/ the board, meters, actions, journal
```

`src/game/` deliberately imports nothing outside itself. That's what lets the
whole game run in a test or a batch simulation with no browser involved.

## The actual workflow

**Tuning.** Open `src/game/rules.js`. Every number that affects balance is in
there — hunger drain per phase, torch cost and burn time, how much damage the
dark does, action points per phase, tile yields. Change one, save, and the
running game picks it up without losing board state.

**Checking a change.** Run `npm run sim`. A heuristic bot plays 500 games and
reports win rate plus a histogram of which day players died on. The bot plays
like a competent first-timer, so treat its results as a floor — if the bot
can't survive past day 6, neither will a human.

**Reproducing a bad game.** Every board comes from a seed, shown in the header.
Type a seed into the box to replay that exact board. Internally each action is
recorded too, so `replay(seed, history)` rebuilds a session move for move —
"seed 7730 fell apart on day 12" becomes something you can actually look at.

## Current balance state

As shipped, the default rules are **too easy** — the bot wins 500 out of 500.
Damage absolutely fires (roughly 4 dark attacks per game, health dipping to 20,
sanity bottoming out at 0), but resources are abundant enough to absorb all of
it. Starting points if you want real pressure:

- `hunger.drainPerPhase` — the single biggest lever
- `biomes.berryPatch.amount` / `.density` — food scarcity
- `recipes.torch.cost` and `.durability` — how cheap safety is
- `phases[].actionPoints` — how much you get done per day

For reference, raising hunger drain to ~9/7/7, cutting berry patches to one
gather, doubling torch cost and halving its burn time produced a 30% win rate
with deaths clustering hard on days 7–8.

Also worth knowing: **gold currently has no use.** It has a biome, a pickaxe
gate and an inventory slot, but nothing consumes it — it's a hook left for
whatever you want it to buy.

## Rules as implemented

- Three phases a day: Day (4 AP), Dusk (2 AP), Night (1 AP). Running out of AP
  ends the phase.
- Hunger drains every phase. At zero it eats health.
- Sanity falls in the dark and recovers in daylight. Below 30, shadows attack
  at night.
- Ending a night unlit costs 20 health. A spear halves that.
- Torches burn for 2 nights; a campfire lights its tile for 5.
- Berries can be cooked at a campfire for more hunger and a little sanity.
