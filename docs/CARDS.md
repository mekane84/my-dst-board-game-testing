# Alpha 1.0 Cards and Components

`LOCKED` = settled for Alpha.
`PROVISIONAL` = current alpha default; keep data-driven/easy to tune.

---

# Starter Cards — LOCKED

Each survivor starts with 3 Gather, 2 Explore, 2 Prepare, 1 Recover.

## Gather

> Gather from one available explored Location and resolve its Gather effect, OR gather at Camp for 1 Wood, 1 Grass, or 1 Flint.

## Explore

> Discover the top Location: resolve Discovery, then Danger, then leave it explored.

## Prepare

> Choose +1 Combat or +1 Protection for tonight.

## Recover

> Heal 1 Health.

Any starter card may instead be used as **Work**.

---

# Fear — LOCKED

## Fear

> No effect. Counts as a hand card. Cannot be used as Work.

When gained, normally add to the owner's discard pile.

---

# Personal Reusable Gear

## Axe — LOCKED

Cost: **1 Wood + 1 Flint**

> Once per Day when you Gather Wood, gain +1 Wood.

**RESOLVED 2026-10-14:** This triggers on **Camp Gather as well as Location
Gather**. The once-per-Day limit is tracked **per Axe card**, but only one Axe may
modify any single Gather. Two Ready Axes therefore give +1 Wood twice in a Day
only if the survivor spends **two separate Gather actions** on Wood.

Maximum 1 Axe modifier per Gather.

## Pickaxe — LOCKED

Cost: **1 Wood + 1 Flint**

> Once per Day when you Gather Flint, gain +1 Flint.

**RESOLVED 2026-10-14:** Triggers on Camp Gather as well as Location Gather. The
once-per-Day limit is tracked per Pickaxe card, but only one Pickaxe may modify a
single Gather — two Ready Pickaxes pay off only across two separate Gather
actions. This is also what the Boulder Field cards already assume: they read
"gain 3 Flint instead", a fixed replacement rather than a stacking bonus.

Maximum 1 Pickaxe modifier per Gather.

## Trap — PROVISIONAL FOOD-TUNING VALUE

Cost: **1 Wood + 1 Grass + 1 Flint**

> Use with Gather at Rabbit Field: gain 2 Food. Then Rabbit Field rests for one full Day.

Without a Ready Trap, Rabbit Field has no repeatable Gather effect in the current Alpha default.

## Backpack — LOCKED

Cost: **2 Grass**

> When drawn and readied, draw 1 additional hand card that Day.

Gear replacement rules still apply to that draw.

**RESOLVED 2026-10-14:** Maximum **1 extra hand card per Day** regardless of how
many Backpacks are Ready. A second Backpack readied the same Day grants nothing
further.

## Map — LOCKED

Cost: **1 Grass + 1 Flint**

> Once per Day when you Explore, draw 2 Location cards instead of 1. Choose 1 to discover and resolve. Put the other on the bottom of the Location deck.

## Shovel — PROVISIONAL COST / LOCKED ROLE

Cost: **1 Wood + 1 Flint**

> Required to transplant a Berry Bush. Using the Shovel for a transplant uses it for the Day but does not destroy it.

Shovel is reusable. Other future digging uses are out of scope.

## Fishing Rod — LOCKED DIRECTION; FOOD YIELD CURRENT ALPHA VALUE

Cost: **1 Wood + 1 Silk**

> Use with Gather at an available Pond: gain 3 Food. Then that Pond rests for one full Day.

Reusable personal Gear.

## Top Hat — LOCKED

Cost: **1 Silk**

> When drawn: permanently remove 1 Fear from your hand, played area, or discard pile. Do not search your draw pile. If no eligible Fear exists, nothing happens.

Top Hat is reusable and continues cycling through the deck.

---

# Personal 2-Use Gear — LOCKED unless noted

## Spear

Cost: **2 Wood + 1 Flint**
Durability: **2 uses**

> Use with one Combat Prepare: that Prepare provides 3 Combat total instead of 1.

Maximum 1 Spear modifier per Prepare.
A Spear may also satisfy Location effects that explicitly require one; doing so spends 1 use.

## Torch

Cost: **1 Wood + 2 Grass**
Durability: **2 uses**

> Use with one Protection Prepare: that Prepare provides 3 Protection total instead of 1.

Maximum 1 Torch modifier per Prepare.
A Torch may also satisfy Location effects that explicitly call for light; doing so spends 1 use.

## Log Suit

Cost: **2 Wood + 2 Grass**
Durability: **2 uses**

> When you would lose Health, spend 1 use to prevent 1 Health loss to yourself.

May prevent Red Moon Health loss.

## Small Campfire

Cost: **1 Wood + 1 Grass**
Durability: **2 uses**

> Action: gain +2 Protection this Night. Also, one survivor may ignore 1 Fear gained this Night.

Clarification for Alpha: each use creates one “ignore the next 1 Fear gained this Night by a chosen survivor” shield. It does not remove existing Fear.

## Garland — PROVISIONAL WORDING; DIRECTION SETTLED

Cost: **3 Grass**
Total uses: **2**, but the two uses work differently.

First use happens immediately when crafted:

> Permanently remove 1 Fear from the crafter's hand, played area, or discard pile.

Then Garland enters the normal deck cycle at cleanup.

Second use happens later when Garland is drawn/readied:

> Action: permanently remove 1 Fear from your hand, played area, or discard pile. Then remove Garland from your deck/game.

**RESOLVED 2026-10-14:** The craft-time use is **always spent**, even if no
eligible Fear exists — crafting Garland with no Fear anywhere wastes that half of
the card. The later draw-use is optional and may be declined without spending it,
but taking it removes Garland from the deck/game as printed.

---

# Major Camp Improvements — LOCKED FOR CURRENT TEST CURVE

These are shared, permanent, and intentionally expensive.

## Fire Pit

Build cost: **3 Wood + 2 Flint**

> At the start of Night, spend 1 Wood to fuel the Fire Pit. If fueled, gain +2 Protection this Night. If not fueled, it provides no Protection.

Only one shared Fire Pit may exist.

## Palisade

Build cost: **4 Wood + 3 Flint**

> Gain +2 Combat every Night.

## Lean-To

Build cost: **3 Wood + 4 Grass**

> The first healing Recover used by the team each Day heals 3 Health instead of 1.

This modifies only the first healing Recover of that Day.

**RESOLVED 2026-10-14:** "Healing" is load-bearing. A Recover played by a survivor
already at max Health is not a healing Recover and does **not** consume the Day's
Lean-To bonus.

## Tent

Build cost: **3 Wood + 5 Grass**

> Once per Day: one survivor may spend 1 action + 1 Food to permanently remove up to 3 Fear from their own hand, played area, and/or discard pile.

Tent is a shared Camp Improvement, but the chosen action affects one survivor's deck.

---

# Food Infrastructure

## Transplanted Berry Bush — PROVISIONAL TRANSPLANT COST; YIELD/COOLDOWN LOCKED DIRECTION

Requirement:

- an explored Berry Grove with its transplant opportunity unused;
- acting survivor has a Ready Shovel.

Current Alpha transplant cost:

- **Work action + 1 Grass**
- use/exhaust the Shovel for the Day (no durability loss; Shovel is reusable)
- mark that Berry Grove's single transplant opportunity as used

Creates one shared Transplanted Berry Bush at Camp.

> Gather: gain 2 Food. Then this Berry Bush regrows for one full Day.

Each discovered Berry Grove supports exactly **one** transplant total.

## Simple Farm Plot — PROVISIONAL COST; CURRENT TEST VALUE

Build cost: **2 Wood + 3 Grass + 1 Flint**

> Gather: gain 3 Food. Then this Farm regrows for one full Day.

Farm is the expensive non-location-gated fallback food route.

---

# Location Deck

The deck should remain a **single Location deck**. No Near/Deep deck and no separate Danger deck.

The intended Alpha deck is currently **23 cards**. Do not delete older Locations merely to hit an arbitrary deck size. If future additions push beyond roughly 24 during this Alpha phase, pause and review scope.

## 1. Dense Forest — Strange Noises — LOCKED

Discovery: gain 1 Wood.

Danger:
> Spend 1 Food or gain 1 Fear.

Gather:
> Gain 3 Wood.

## 2. Dense Forest — Spider Woods — LOCKED

Discovery: gain 1 Wood.

Danger:
> You may spend 1 Spear use to ignore this Danger. Otherwise lose 1 Health or gain 2 Fear.

Gather:
> Gain 3 Wood.

## 3. Savanna — Open Plains — LOCKED

Discovery: gain 1 Grass.
Danger: Calm.

Gather:
> Gain 3 Grass.

## 4. Savanna — Scorching Sun — LOCKED

Discovery: gain 1 Grass.

Danger:
> Lose 1 Hunger or gain 1 Fear.

Gather:
> Gain 3 Grass.

## 5. Boulder Field — Loose Rocks — LOCKED

Discovery: gain 1 Flint.

Danger:
> Lose 1 Health or gain 1 Fear.

Gather:
> Gain 2 Flint. If using a Ready Pickaxe, gain 3 Flint instead.

## 6. Boulder Field — Cave Echoes — LOCKED

Discovery: gain 1 Flint.

Danger:
> Spend 1 Food or gain 2 Fear.

Gather:
> Gain 2 Flint. If using a Ready Pickaxe, gain 3 Flint instead.

## 7. Berry Grove — Peaceful Grove — PROVISIONAL UPDATED FOOD VERSION

Discovery: gain **2 Food**.
Danger: Calm.

No repeatable wild-berry Gather.
This Location provides exactly **1 transplantable Berry Bush opportunity**.

## 8. Berry Grove — Something Feeding Here — PROVISIONAL UPDATED FOOD VERSION

Discovery: gain **2 Food**.

Danger:
> Spend 1 Food or gain 1 Fear.

No repeatable wild-berry Gather.
This Location provides exactly **1 transplantable Berry Bush opportunity**.

## 9. Rabbit Field — PROVISIONAL FOOD-TUNING VERSION

Discovery: gain 1 Food.
Danger: Calm.

Gather:
> Only if using a Ready Trap: gain 2 Food, then Rabbit Field rests for one full Day.

## 10. Mixed Woodland — Tangled Thicket — LOCKED

Discovery: choose gain 1 Wood or 1 Grass.

Danger:
> Lose 1 Health or gain 1 Fear.

Gather:
> Choose gain 2 Wood or 2 Grass.

## 11. Marsh — Murky Ground — LOCKED FOR ALPHA, WATCH BALANCE

Discovery: choose gain 1 Food or 1 Grass.

Danger:
> Lose 1 Hunger or gain 2 Fear.

Gather:
> Gain 1 Food + 1 Grass.

## 12. Pond — Croaking Banks — PROVISIONAL UPDATED FISHING VERSION

Discovery: gain 1 Food.

Danger:
> Lose 1 Hunger or gain 1 Fear.

Gather:
> Only if using a Ready Fishing Rod: gain 3 Food, then this Pond rests for one full Day.

## 13. Flower Meadow — LOCKED

Discovery:
> Permanently remove 1 Fear from any survivor. If no survivor has Fear, gain 1 Grass instead.

Danger: Calm.

Gather:
> Gain 1 Grass.

## 14. Rocky Clearing — Sharp Stones — LOCKED

Discovery: choose gain 1 Wood or 1 Flint.

Danger:
> Lose 1 Health or gain 1 Fear.

Gather:
> Gain 1 Wood + 1 Flint.

## 15. Carrot Patch — Rustling Grass — LOCKED

Discovery: gain 3 Food.

Danger:
> Return/spend 1 of that Food or gain 1 Fear.

No ongoing Gather.

## 16. Fallen Timber — Unstable Pile — LOCKED

Discovery: gain 3 Wood.

Danger:
> Return 1 Wood or lose 1 Health.

No ongoing Gather.

## 17. Abandoned Camp — PROVISIONAL EXPLICIT RESOURCE LIST

Discovery:
> Take 3 total resources chosen from Food, Wood, Grass, and Flint; maximum 2 of the same resource.

Danger:
> Gain 1 Fear or keep only 2 of the 3 resources.

No ongoing Gather.

## 18. Quiet Clearing — PROVISIONAL EXPLICIT RESOURCE LIST

Discovery:
> Choose 2 different resources from Food, Wood, Grass, and Flint and gain 1 of each.

Danger: Calm.
No ongoing Gather.

## 19. Quiet Pond — PROVISIONAL NEW LOCATION

Discovery: gain 1 Food.
Danger: Calm.

Gather:
> Only if using a Ready Fishing Rod: gain 3 Food, then this Pond rests for one full Day.

## 20. Spider Den — PROVISIONAL NEW SILK LOCATION

Discovery / Danger:
> If you use a Ready Spear (spend 1 Spear use), gain 2 Silk and mark the Den cleared. Otherwise gain 1 Fear; the Silk remains unclaimed.

Later Gather while uncleared:
> If using a Ready Spear, spend 1 Spear use, gain 2 Silk, and mark the Den cleared.

Once cleared, it has no further Gather effect.

## 21. Spider Warrior — PROVISIONAL NEW SILK LOCATION

Discovery / Danger:
> If you use a Ready Spear (spend 1 Spear use), gain 1 Silk + 1 Food. Otherwise lose 1 Health and gain 1 Fear.

No ongoing Gather.

## 22. Merm-Spider Aftermath — LOCKED FLAVOR/REWARD

Flavor:
> “You find the remains of a spider nearby a Merm house.”

Discovery: gain **1 Silk only**.
Danger: Calm.
No Food.
No ongoing Gather.

## 23. Berry Grove — Thorny Brambles — PROVISIONAL THIRD BERRY CARD

Discovery: gain 2 Food.

Danger:
> Gain 1 Fear or return 1 of the Food gained here.

No repeatable wild-berry Gather.
This Location provides exactly **1 transplantable Berry Bush opportunity**.

---

# Night Cards — LOCKED CURRENT WORKING SET

Let `P` = player count. Alpha 1.0 uses P = 2, but encode formulas generically.

## Early Nights (Nights 1–3)

### Distant Howls

- **Quieted:** Combat >= P → nothing.
- **Kept Awake:** Combat < P → each survivor gains 1 Fear.

### Hound Scouts

- **Driven Off:** Combat >= P + 2 → nothing.
- **Scratched Up:** Combat >= P → assign 1 total Health loss.
- **Mauled:** Combat < P → each survivor loses 1 Health; one survivor gains 1 Fear.

### Cold Rain

- **Kept Dry:** Protection >= P + 1 → nothing.
- **Soaked Through:** below threshold → each survivor loses 1 Hunger.

## Mid Nights (Nights 4–7)

### Light Rain

- **Sheltered:** Protection >= P → nothing.
- **Miserable Night:** below threshold → spend 1 shared Food OR one survivor loses 1 Hunger.

### Food Thieves

- **Chased Away:** spend P Food → nothing further.
- **They Grab a Few:** spend ceil(P / 2) Food → one survivor loses 1 Hunger.
- **Pantry Raided:** pay less → each survivor loses 1 Hunger; one survivor gains 1 Fear.

Implementation note: because this Night explicitly asks the team how much Food to pay, present the legal outcome/payment choices rather than auto-spending.

### Restless Shadows

- **Shadows Recede:** Protection >= 2P + 1 → nothing.
- **Uneasy Night:** Protection >= P + 1 → each survivor gains 1 Fear.
- **Surrounded:** Protection < P + 1 → each survivor gains 2 Fear.

### Spider Swarm

- **Nest Cleared:** Combat >= 2P + 2 → gain 1 shared Food.
- **Bitten Back:** Combat >= P + 2 → assign 1 total Health loss + 1 total Fear.
- **Overrun:** below threshold → assign P total Health loss; each survivor gains 1 Fear.

## Late Nights (Nights 8–9)

### Long Night

- **Kept at Bay:** Protection >= 2P + 3 → nothing.
- **Night Terrors:** below threshold → each survivor gains 1 Fear and loses 1 Hunger.

### Alpha Hounds

- **Pack Broken:** Combat >= 2P + 3 → nothing.
- **Bloodied:** Combat >= 2P + 1 → assign 2 total Health loss; one survivor gains 1 Fear.
- **Torn Apart:** below threshold → each survivor loses 1 Health; assign 1 additional Health loss; each survivor gains 1 Fear.

## Night 10 — Red Moon

Resolve **two separate checks**.

### Hounds check

- **Pack Broken:** Combat >= 2P + 3
- **Bloodied:** Combat >= 2P + 1
- **Torn Apart:** below

### Darkness check

- **Darkness Held Back:** Protection >= P + 3
- **Shadows Break Through:** Protection >= P + 2
- **Consumed by Darkness:** below

For **each** of the two checks independently:

- top result: each survivor loses 0 Health;
- middle result: each survivor loses 1 Health;
- bottom result: each survivor loses 3 Health.

No hard “must reach middle” requirement. Survival is determined by Health remaining after both checks and any prevention such as Log Suit.

