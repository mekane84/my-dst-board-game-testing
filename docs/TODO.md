# TODO / Provisional Decisions

These items are intentionally **not fully locked**. Claude Code should implement the documented Alpha default but should not reinterpret or rebalance them without explicit instruction.

## 1. Exact physical semantics of action-cost Gear/Camp abilities

Alpha digital default:

- Small Campfire, Garland second use, and Tent can be selected as the player's action for one of the three action rounds without consuming a starter action card.

Reason for provisional status:

- the physical card game may eventually prefer a different representation.

## 2. End-of-Day cleanup wording

Alpha default:

- discard remaining hand, played starter cards, and unbroken Ready/used Gear after Night.

This is required for the deck-builder loop but should be confirmed during first human tests.

## 3. Shovel exact cost

Alpha default: **1 Wood + 1 Flint**.

Role is locked: Shovel is reusable Personal Gear and is required to transplant Berry Bushes.

## 4. Berry transplant resource cost

Alpha default:

- Work action
- Ready Shovel
- 1 Grass
- one transplant opportunity consumed from that Berry Grove

Each Berry Grove can create only one transplanted bush total.

## 5. Simple Farm exact build cost

Alpha default: **2 Wood + 3 Grass + 1 Flint**.

Yield/cooldown direction is currently:

- 3 Food
- then one full Day regrowth

Farm should remain much more expensive than the Berry route because Farm does not require discovering a specific food Location.

## 6. Rabbit Field final values

Alpha default:

- Discovery +1 Food
- no repeat Gather without Trap
- Ready Trap + Gather => 2 Food
- then Rabbit Field rests one full Day

This was intentionally nerfed so Fishing feels more special.

## 7. Pond / Fishing final values

Alpha default:

- Fishing Rod cost 1 Wood + 1 Silk
- Ready Fishing Rod + Gather at Pond => 3 Food
- Pond rests one full Day

Design intent is strongly settled: Fishing should feel special and powerful because it requires rare Silk + discovering a Pond.

## 8. Garland exact wording

Current direction is settled but card wording is still provisional.

Alpha default:

- cost 3 Grass;
- first Fear removal immediately on craft;
- later draw/readied Garland can spend an action to remove one more Fear;
- then Garland leaves the deck.

## 9. Location deck exact food tuning

The following are intentionally provisional and should be surfaced in data/config:

- Berry Grove immediate Food values;
- third Berry Grove exact Danger;
- second Pond exact Danger;
- Spider Den exact failure/retry behavior;
- Spider Warrior exact Food reward;
- Marsh remaining a repeatable 1 Food + 1 Grass source;
- Abandoned Camp / Quiet Clearing being allowed to choose Food.

Do not delete Locations to force the deck back to 18. Current target is 23.

## 10. Night timing details

Alpha default order:

1. Fire Pit fuel decision
2. eating/Hunger
3. total Combat/Protection
4. resolve Night
5. defeat check
6. cleanup

If human testing shows timing creates unintuitive Food interactions, revisit explicitly.

## 11. Small Campfire Fear shield exact timing

Alpha default:

- each use selects one survivor;
- that survivor ignores the next 1 Fear they would gain during that Night;
- unused shield expires after the Night;
- it does not remove existing Fear.

## 12. Number of physical copies

Digital Alpha does not need component limits unless otherwise stated.

Current default:

- players may craft multiple copies of Personal Gear if they can pay;
- only one shared Fire Pit exists;
- other major Camp Improvements are one copy each;
- Farms and transplanted Berry Bushes may have multiple copies subject to costs/gating.

## 13. 4–6 players

Out of scope until the 2-player Alpha is fun/stable.

Potential future scaling problems to study later:

- Location once-per-Day limits become more restrictive with more players;
- food consumption grows quickly;
- Camp upgrades may become easier to fund due to more actions/resources;
- fixed +2 Palisade/Fire Pit bonuses become proportionally weaker;
- Tent affects only one survivor per use while Fear exists across more decks;
- Night formulas already use P but have not been validated for 4–6.

Do not preemptively rebalance Alpha 1.0 around these concerns.

