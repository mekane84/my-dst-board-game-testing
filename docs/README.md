# Don't Starve-Inspired Co-op Deck-Builder — Alpha 1.0 Handoff

This folder is the implementation handoff for a **2-player local/hotseat Alpha 1.0** of a cooperative survival deck-building board-game prototype inspired by *Don't Starve Together*.

The goal of Alpha 1.0 is **rules testing and balance testing**, not production polish.

## Read these files in this order

1. `CLAUDE.md` — coding-agent instructions and non-negotiable implementation constraints.
2. `GAME_SPEC.md` — product intent, design pillars, and overall game loop.
3. `ALPHA_1_RULES.md` — current playable rules.
4. `CARDS.md` — current card/component inventory and exact/provisional card text.
5. `BALANCE_GOALS.md` — what “good balance” means and what telemetry to record.
6. `IMPLEMENTATION_PLAN.md` — recommended build sequence and architecture.
7. `TODO.md` — intentionally unresolved/provisional items. Do not silently resolve them.
8. `alpha1_card_data.json` — starter machine-readable card/reference data for implementation.

## Alpha 1.0 scope

- Exactly **2 survivors** for the first human-playtest build.
- Local browser game; no backend, accounts, matchmaking, networking, or database.
- Hotseat secret-action mode plus a developer “control both players” mode.
- 10 Days/Nights; Night 10 is always Red Moon.
- Seeded deterministic RNG and exportable game logs are required.
- UI can be utilitarian. Correct rules and reproducible tests matter more than art.
- Character-specific powers/progression, Gold, Science Machine, Crock Pot, Drying Rack, advanced farming, and 4–6 player balance are out of scope.

## Suggested command to give Claude Code

> Read every markdown file in this repository before coding. Treat `CLAUDE.md` as mandatory instructions. Implement the 2-player Alpha 1.0 faithfully. Do not rebalance, reinterpret, or invent rules. Where `TODO.md` marks a rule provisional, implement the documented alpha default and make it easy to change in data/config. Keep game logic UI-independent and deterministic. Write automated tests for rules as you implement them.

