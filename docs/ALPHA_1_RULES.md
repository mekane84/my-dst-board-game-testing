# Alpha 1.0 Rules

Rules labeled **LOCKED** are settled for the current Alpha. Rules labeled **PROVISIONAL ALPHA DEFAULT** are implemented now but intentionally easy to tune later.

## 1. Setup — LOCKED

Alpha 1.0 uses exactly 2 survivors.

Each survivor begins with:

- 5 Health
- 2 Hunger
- an 8-card personal starter deck:
  - 3 Gather
  - 2 Explore
  - 2 Prepare
  - 1 Recover

Shared resources begin at:

- Food 0
- Wood 0
- Grass 0
- Flint 0
- Silk 0

Shuffle each survivor's deck independently.

Prepare the Location deck and Night decks.

Night structure:

- Nights 1–3: shuffle the 3 Early Night cards.
- Nights 4–7: shuffle the 4 Mid Night cards.
- Nights 8–9: shuffle the 2 Late Night cards.
- Night 10: Red Moon, fixed.

## 2. Drawing and deck cycling — LOCKED

At the start of each Day, each survivor draws until they have **5 hand cards**.

### Gear replacement draw

Whenever a Personal Gear card is drawn:

1. Move it immediately to that survivor's **Ready Gear** area.
2. Draw a replacement card.
3. Continue until the survivor has 5 hand cards (or the relevant draw effect is satisfied).

Gear therefore does not consume one of the standard hand slots.

### Fear cards

Fear cards:

- stay in hand when drawn;
- count toward the 5-card hand;
- have no printed action effect;
- cannot be used as Work;
- therefore reduce the player's available useful action-card choices.

When Fear is gained, put it in that survivor's discard pile unless an effect says otherwise.

### Reshuffle

If a personal draw pile is empty when a card must be drawn, shuffle that survivor's discard pile to form a new draw pile.

### End-of-Day cleanup — PROVISIONAL ALPHA DEFAULT

After the Night resolves:

- discard all remaining hand cards;
- discard all played starter cards;
- discard all Ready Gear that was not removed/broken;
- used reusable Gear also goes to discard unless its own text removes it;
- Fear in hand/played areas goes to discard.

## 3. The three Day action rounds — LOCKED

Each Day contains exactly **3 action rounds**.

For each round:

1. Each survivor secretly selects one action.
2. Reveal simultaneously.
3. Team chooses the order in which the revealed actions resolve.
4. Players may discuss freely before the next round.

### Normal action-card actions

A player may select a starter action card from hand and either:

- resolve its printed effect; or
- use it as **Work**.

After resolving it, place it in the player's played/discard flow for end-of-Day cleanup.

### Action-cost Gear/Camp abilities — PROVISIONAL ALPHA DEFAULT

Some Ready Gear or Camp abilities say they cost **1 action** (for example Small Campfire, Garland second use, Tent).

For digital Alpha 1.0, such an ability may be selected **instead of playing a starter action card** for that action round. It consumes one of the player's 3 daily actions but does not require discarding a starter card.

This rule is intentionally centralized so it can be changed easily after physical playtesting.

## 4. Starter action cards — LOCKED

### Gather

Choose one:

- Gather from an available explored Location and resolve its Gather effect; or
- Gather at Camp for exactly **1 Wood, 1 Grass, or 1 Flint**.

Food can never be chosen from Camp Gather.

Unless a Location says otherwise, each explored Location may be Gathered from at most **once per Day**.

Camp Gather has no once-per-Day limit.

### Explore

Normally:

1. Draw exactly 1 Location card.
2. Resolve its Discovery effect.
3. Resolve its Danger effect.
4. Place it face-up in the shared explored area.

You may not reject/discard an unwanted Location.

If the Location deck is empty, Explore finds nothing. The Explore action card may still be used as Work.

Map can modify Explore.

### Prepare

Choose one:

- +1 Combat for tonight; or
- +1 Protection for tonight.

Place/record that Prepare contribution until Night.

Spear may modify a Combat Prepare.
Torch may modify a Protection Prepare.

### Recover

Heal **1 Health** to the acting survivor, up to max 5.

Recover no longer removes Fear by itself.

Lean-To can improve the first healing Recover each Day.

## 5. Work / crafting — LOCKED

Any starter action card (Gather, Explore, Prepare, Recover) may be used as **Work** instead of its printed effect.

Work can:

- craft Personal Gear for the acting survivor;
- build a shared Camp Improvement;
- build food infrastructure;
- perform a transplant action where specified.

Pay all listed shared resource costs immediately.

Fear cannot be Work.
Personal Gear cannot be Work.

### Newly crafted Gear

Newly crafted Personal Gear becomes **Ready immediately that Day**.
It can be used that Day if legal.
At cleanup it enters the normal discard/deck cycle.

## 6. Reusable Gear — LOCKED

Reusable Gear is not destroyed by normal use.

When a reusable Gear card's effect is used:

- resolve the effect;
- mark it used for the Day / move it to the used Gear area;
- it goes to discard at cleanup;
- it can be drawn again in a later cycle.

Unused Ready Gear may be left unused and is discarded normally at cleanup.

Unless a card says otherwise, a single Ready copy may be used at most once that Day.

### Gear modifiers — RESOLVED 2026-10-14

Generalizes the per-card limits printed on Axe, Pickaxe, Spear and Torch:

> A single action may be modified by at most **one Gear of a given type**.
> Each Gear card's own once-per-Day limit is tracked **per card**.

So a survivor holding two Ready Axes can gain +1 Wood twice in a Day, but only by
spending two separate Gather actions — never +2 on one Gather. The same applies
to Pickaxe on Gather, and to Spear and Torch on Prepare.

Rationale: actions are the scarcest resource in Alpha 1.0, so letting modifiers
stack on a single action compresses that scarcity and makes duplicate tools an
auto-build rather than a choice.

## 7. Two-use Gear — LOCKED

Spear, Torch, Log Suit, Small Campfire, and Garland use the 2-use/durability model.

- Each has 2 total uses unless its special wording says how the two uses occur.
- A use is only spent when its effect is actually activated.
- Mark one durability icon/charge per use.
- After the second use, remove that card from the personal deck/game rather than discarding it.
- Drawing it without using it does not consume durability.
- Newly crafted 2-use Gear becomes Ready immediately.

## 8. Food / Hunger — LOCKED

Food is shared.

At the **start of Night**, each survivor may spend **1 shared Food** to eat.

For each survivor:

- if they eat: no Hunger loss;
- if they do not eat and Hunger > 0: lose 1 Hunger;
- if they do not eat and Hunger is already 0: lose 1 Health instead.

Hunger minimum is 0 and maximum is 2.

### Hunger loss at 0 — RESOLVED 2026-10-14

This generalizes the starvation clause above to **every** source of Hunger loss,
not just skipped meals.

> Whenever a survivor would lose Hunger and their Hunger is already 0, they lose
> **1 Health** instead.

This applies to Night cards (Cold Rain, Light Rain, Food Thieves, Long Night),
Location Dangers (Scorching Sun, Marsh, Pond), and any future effect. Implement
it as one centralized helper so no effect can bypass it.

Food is never available from Camp Gather.

## 9. Renewable food cooldown — LOCKED

Transplanted Berry Bushes, Farm Plots, Rabbit Field when trapped, and Ponds when fished use a one-full-Day cooldown.

Implementation rule:

> If harvested on Day D, that source is unavailable on Day D+1 and becomes available again at the start of Day D+2.

This is the authoritative digital interpretation of “regrows/rests for one full Day.”

## 10. Fear — LOCKED

Fear is a dead personal deck card.

- Gained Fear normally goes to discard.
- When drawn, Fear occupies a hand slot.
- Fear has no action effect.
- Fear cannot be Work.
- Fear is permanently removed from the deck only by effects that explicitly say so (Garland, Top Hat, Tent, Flower Meadow, etc.).

Assigned Fear is allocated cooperatively when a shared effect allows a choice.

## 11. Assigned damage — LOCKED

When an effect says to assign a total amount of Health loss or Fear, the team chooses how to distribute it unless the card says “each survivor.”

Any survivor reaching 0 Health immediately causes team defeat.

## 12. Night timing — PROVISIONAL ALPHA DEFAULT

The full Night card is revealed at the start of the Day.

At Night:

1. Decide whether to fuel Fire Pit (if built).
2. Resolve eating/Hunger for each survivor.
3. Total all Combat and Protection generated for the Night.
4. Resolve the Night card's outcome(s).
5. If anyone reaches 0 Health, lose immediately.
6. Perform cleanup.

## 13. Win condition — LOCKED

Survive all effects of **Night 10: Red Moon** with every survivor above 0 Health.

There is no resurrection in Alpha 1.0.

