# Recommended Implementation Plan

Build in small vertical slices and keep the app playable/tests green after every phase.

## Phase 1 — Project + deterministic engine shell

- React + TypeScript + Vite.
- Add Vitest.
- Implement seeded RNG.
- Define `GameState`, `PlayerState`, resources, zones, Day/Night counters.
- Implement deterministic shuffle.
- Unit test same seed => same order.

## Phase 2 — Personal decks and Day draw

Implement:

- 8-card starter decks;
- draw 5;
- discard/reshuffle;
- Fear cards occupying hand slots;
- Gear bypassing hand into Ready Gear and triggering replacement draws;
- Backpack extra draw.

Tests:

- Fear reduces useful hand size.
- Gear never consumes normal hand slot.
- multiple Gear drawn in sequence still refill correctly.
- empty draw pile reshuffles correctly.

## Phase 3 — Day action system

Implement:

- exactly 3 action rounds;
- hidden selection structure;
- simultaneous reveal;
- chosen resolution order;
- starter actions;
- Work;
- action-cost Gear/Camp abilities.

Initially developer mode can expose both hands.

## Phase 4 — Shared resources + crafting + Gear

Implement all Personal Gear and Camp costs.

Implement:

- Ready immediately when crafted;
- reusable Gear exhaustion/use;
- 2-use durability;
- break/removal after second use;
- Spear/Torch Prepare modifiers;
- Log Suit prevention;
- Garland special two-stage use;
- Top Hat draw trigger.

## Phase 5 — Locations and exploration

Implement Location deck as data-driven cards/effects.

Need Location state fields such as:

- gatheredThisDay;
- cooldownUntilDay / availableOnDay;
- transplantAvailable / transplantUsed;
- spiderDenCleared;
- oneShotResolved.

Implement Map draw-2 choose-1.

## Phase 6 — Food systems

Implement:

- no Food from Camp Gather;
- Berry transplant with Shovel;
- Berry cooldown;
- Farm build/harvest/cooldown;
- Rabbit + Trap/cooldown;
- Pond + Fishing Rod/cooldown;
- Silk acquisition.

Test cooldown rule carefully:

- harvested Day D;
- unavailable D+1;
- available D+2.

## Phase 7 — Fear / healing / Camp infrastructure

Implement:

- Recover heals only;
- Lean-To first Recover bonus;
- Tent action;
- Flower Meadow;
- Small Campfire Fear shield;
- Fire Pit build/fuel;
- Palisade.

## Phase 8 — Night system

Implement Night deck bands and all Night cards.

Night UI should show the **full upcoming Night card at start of Day**.

At Night resolve:

- Fire Pit fuel decision;
- eating/Hunger;
- Combat/Protection totals;
- Night outcome;
- damage prevention choices such as Log Suit;
- defeat check;
- cleanup.

Implement Red Moon as two independent checks.

## Phase 9 — Usable browser UI

Recommended layout:

### Top/public area

- Day / upcoming Night
- seed
- shared resources
- shared Camp Improvements
- food infrastructure
- explored Locations + cooldown states

### Player panels

- Health / Hunger
- hand
- Ready Gear + durability
- deck/discard counts
- Fear count

### Action area

- current action round 1/2/3
- select action
- lock
- pass-screen for hotseat
- reveal
- choose resolution order

### Log

- chronological event log
- collapsible detail

## Phase 10 — Reproducibility/export

Add:

- restart same seed;
- copy seed;
- export current state JSON;
- export full event log JSON/text;
- optional import of a saved state later.

## Phase 11 — Simulation runner

The simulator must instantiate the exact same engine without React.

Implement simple policies listed in `BALANCE_GOALS.md`.

Allow:

- N games;
- starting seed / sequential seeds;
- policy selection;
- CSV/JSON results.

Do not block Alpha UI completion on sophisticated AI. Simple heuristic bots are sufficient initially.

## Phase 12 — Human Alpha loop

After the first working build:

1. play 6–10 real 2-player games;
2. export logs;
3. identify confusing/automatic/unfun choices;
4. compare against simulation statistics;
5. revise data values into Alpha 1.1;
6. only after 2-player play feels consistently good, begin 4–6 player simulation/scaling work.

