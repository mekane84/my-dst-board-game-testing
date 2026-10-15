# Balance Goals and Playtest Telemetry

## Alpha 1.0 balance philosophy

This is a 2-player tutorial-ish survival game, not a solved puzzle.

Desired behavior:

- Good balanced play should usually win.
- Bad strategic choices should be capable of losing.
- With optimal play + perfect foreknowledge, almost every seed should be winnable; unavoidable bad-order losses should be extremely rare.
- Exploration should be a major route to victory and usually stronger than staying at Camp.
- Over-exploration should create meaningful Fear and immediate Night risk.
- Food should feel central and stressful without becoming an unavoidable lottery.

## Camp Improvement target

Normal successful game:

- often builds **2–3** major Camp Improvements.

Camp-heavy strategy:

- can build **3–4**.

All four:

- should be achievable;
- should require deliberate prioritization;
- should noticeably reduce spending on personal Gear/economic options;
- should feel extremely powerful once achieved.

Do **not** impose a hard numerical Camp-upgrade cap.

## Desired relationship: personal Gear vs Camp

Personal Gear should feel tactically excellent now.

Camp Improvements should feel expensive but produce long-term team strength.

Examples:

- Spear solves immediate Combat and Spider problems but breaks after 2 uses.
- Palisade permanently adds Combat.
- Torch gives excellent Protection/action efficiency but breaks.
- Fire Pit saves actions but requires ongoing Wood.
- Log Suit prevents immediate damage.
- Lean-To efficiently repairs damage after it happens.
- Garland is a temporary/common Fear solution.
- Top Hat is a rare reusable Fear solution.
- Tent is large-scale shared Fear-management infrastructure.

## Food hierarchy target

Current intended rough hierarchy:

- one-time food finds = immediate survival buffer;
- transplanted Berry Bush = 2 Food, then one full Day cooldown;
- Rabbit + Trap = 2 Food, then one full Day cooldown;
- Farm = 3 Food, then one full Day cooldown, but expensive and forceable;
- Fishing = 3 Food, then one full Day cooldown, gated by Pond + rare Silk and should feel special/powerful.

Fishing should feel better/more exciting than Rabbit trapping.

## Resource-economy watch list

Track end-of-game and peak surplus for:

- Food
- Wood
- Grass
- Flint
- Silk

Current design expectation:

- Wood is often the tightest basic resource due to broad crafting + Fire Pit fuel.
- Grass should have meaningful sinks (Torch, Garland, Tent, Farm, etc.).
- Flint may be more likely to surplus late; 2-use Spears and expensive Palisade/Fire Pit help.
- Silk should create difficult Fishing Rod vs Top Hat choices.

If a basic resource repeatedly ends games with large unused stockpiles, first consider:

1. adjusting thematic costs of existing crafts;
2. then adding a small number of useful craftables;
3. avoid adding content solely for variety before testing shows a real economy hole.

## Camp sequencing test

We specifically want to learn whether first-upgrade choice is situational.

Record for every simulated/human game:

- first Camp Improvement built;
- Day built;
- second/third/fourth build order;
- team state when each was chosen;
- resources available;
- what competing craft was skipped.

It is acceptable for Fire Pit to be the most common first build.

Warning sign:

> one upgrade is first in almost every seed, even when the corresponding threat is not the team's main problem.

## Human playtest metrics

After each actual game, record at minimum:

- seed;
- win/loss;
- final Day reached;
- final Health/Hunger of each survivor;
- first/second/third/fourth major Camp upgrades and Days built;
- main food route(s);
- personal items crafted and how many replacement copies were crafted;
- total Fear gained / removed if available;
- maximum Fear-card count in either survivor's deck;
- ending Food/Wood/Grass/Flint/Silk;
- one moment that felt especially good;
- one moment/card/rule that felt frustrating, pointless, automatic, or confusing.

## Automated simulation strategies to implement

Do not expect bots to be optimal initially. The purpose is comparative pressure testing.

### Balanced policy

- maintain near-term food safety;
- Explore regularly;
- craft a food engine when available;
- prepare enough to avoid severe Night outcomes;
- choose Camp Improvements based on current weakness;
- avoid excessive Fear.

### Camp-heavy policy

- prioritize resource Locations;
- prefer building major Camp Improvements over nonessential personal Gear;
- still solve imminent starvation/death threats.

### Gear-heavy policy

- prioritize personal Gear and replacement 2-use Gear;
- delay Camp Improvements unless clearly necessary.

### Exploration-heavy policy

- Explore very frequently;
- value Map;
- accept more Fear;
- prioritize Tent/Top Hat/Garland when Fear becomes dangerous.

### Low-exploration policy

- Explore minimally;
- rely heavily on Camp Gather and Farm fallback;
- useful as a deliberately inferior benchmark.

## Useful simulation outputs

For a batch of N games, report:

- win rate;
- mean/median Day of defeat;
- win rate by policy;
- build rate and average build Day for every Gear/Camp item;
- Camp Improvement first-choice distribution;
- food-route frequency;
- mean resources gathered/spent by type;
- mean end-of-game surplus by type;
- total Fear gained/removed;
- mean cards of Fear in decks at end;
- mean number of 2-use Gear cards broken;
- damage by source;
- starvation damage;
- Night-card outcome frequencies;
- seeds producing suspicious/unavoidable-looking losses.

## Balance-change principle

If players invest heavily in expensive Camp Improvements but still struggle too much, prefer **making those expensive Improvements stronger** before simply making them cheaper.

