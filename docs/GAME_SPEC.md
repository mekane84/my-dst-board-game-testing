# Game Specification — Alpha 1.0

## Concept

A **cooperative survival deck-builder for 1–4 eventually, but Alpha 1.0 is 2 players only**. The game is inspired by *Don't Starve Together*: players explore a dangerous wilderness, establish renewable food routes, craft temporary and reusable Gear, improve a shared Camp, manage Fear/Hunger/Health, and survive 10 Nights.

The game should create repeated tension between:

- **survive tonight** versus **invest for later**;
- **explore for powerful discoveries** versus **stay safe at Camp**;
- **temporary/personal Gear** versus **expensive permanent Camp infrastructure**;
- **Food security** versus **other resource spending**;
- using rare **Silk for Fishing** versus **Fear control**.

## Difficulty philosophy

Alpha 1.0 is a tutorial-ish difficulty.

- Good balanced play should usually win.
- Poor strategic choices should be able to lose.
- With optimal play plus perfect foreknowledge, losses from unlucky deck order should be extremely rare.
- Exploration should be strong and fun, but dangerous enough that excessive exploration creates Fear-management pressure.
- A no-Explore strategy should be clearly inferior but not automatically impossible.

## Session structure

- 10 Days/Nights.
- Night 10 is always **Red Moon**.
- Night card for the coming Night is revealed at the **start of the Day**, allowing planning.
- Each Day contains **3 simultaneous action rounds**.

## Team state

Shared resources:

- Food
- Wood
- Grass
- Flint
- Silk (rare/special; exploration-only)

Each survivor starts with:

- 5 Health (max 5)
- 2 Hunger (max 2)
- identical starter deck for Alpha 1.0

If any survivor reaches **0 Health**, the entire team immediately loses.

Survive Night 10 to win.

## Resource identity

### Food
Food is intentionally special.

- Food **cannot** be gathered at Camp.
- Food comes from exploration, one-time finds, renewable discovered food Locations, or food infrastructure.
- Food is used to avoid Hunger loss and by some effects such as Tent/Night cards.

### Wood
Universal building/fuel material.

- Frequent Gear ingredient.
- Fire Pit requires ongoing Wood fuel.

### Grass
Survival/comfort/camp material.

- Used for Torch, Garland, Tent, Farm, Backpack, etc.

### Flint
Tools/combat/hard construction material.

- Used for tools, Spear, Trap, Map, Fire Pit, Palisade, etc.

### Silk
Rare specialization resource.

- Cannot be Camp Gathered.
- Comes only from specific Spider-related exploration Locations.
- Main Alpha choice: **Fishing Rod** versus **Top Hat**.

## Design families

### Personal reusable Gear
Cycles through the owner's deck indefinitely unless otherwise specified.
Examples: Axe, Pickaxe, Shovel, Fishing Rod, Backpack, Map, Top Hat.

### Personal 2-use Gear
Has exactly 2 durability/use charges. After second use, remove from the deck.
Examples: Spear, Torch, Log Suit, Small Campfire. Garland is a special 2-use consumable with an immediate craft effect.

### Major Camp Improvements
Expensive shared permanent upgrades. Target behavior:

- normal successful games often build 2–3;
- building all 4 is possible but should require a deliberate Camp-heavy strategy;
- timing/order should matter more than an artificial hard cap.

Major Improvements:

- Fire Pit
- Palisade
- Lean-To
- Tent

### Food infrastructure
Permanent shared objects, but not counted as “major Camp Improvements” for balance targets.

- Transplanted Berry Bushes
- Simple Farm Plots

## Anti-quarterbacking / simultaneous planning

Players may discuss freely and may verbally state what is in their hands, but in the physical design they may **not physically show hands**.

Digital Alpha hotseat should preserve this by hiding the other player's hand during selection.

Each Day:

1. Reveal tonight's Night card.
2. Draw/refill hands and ready drawn Gear.
3. Action Round 1: both secretly choose; reveal simultaneously; resolve in chosen order.
4. Discuss.
5. Repeat for Action Rounds 2 and 3.
6. Resolve Night setup, feeding, threats, and cleanup.

