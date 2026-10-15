/**
 * The four starter action cards, transcribed from docs/CARDS.md.
 *
 * Every survivor begins with 3 Gather, 2 Explore, 2 Prepare, 1 Recover.
 * Any of them may instead be used as Work (crafting / building), which is why
 * they all carry `canWork: true`. Fear and Personal Gear never can.
 */

export const STARTER_CARDS = {
  gather: {
    id: 'gather',
    name: 'Gather',
    kind: 'starter',
    canWork: true,
    text: 'Gather from one available explored Location and resolve its Gather effect, OR gather at Camp for 1 Wood, 1 Grass, or 1 Flint.',
  },
  explore: {
    id: 'explore',
    name: 'Explore',
    kind: 'starter',
    canWork: true,
    text: 'Discover the top Location: resolve Discovery, then Danger, then leave it explored.',
  },
  prepare: {
    id: 'prepare',
    name: 'Prepare',
    kind: 'starter',
    canWork: true,
    text: 'Choose +1 Combat or +1 Protection for tonight.',
  },
  recover: {
    id: 'recover',
    name: 'Recover',
    kind: 'starter',
    canWork: true,
    text: 'Heal 1 Health.',
  },
}

/**
 * Fear: a dead card that still occupies a hand slot. No action effect, and it
 * explicitly cannot be used as Work -- that is the whole cost of Fear.
 */
export const FEAR_CARD = {
  id: 'fear',
  name: 'Fear',
  kind: 'fear',
  canWork: false,
  text: 'No effect. Counts as a hand card. Cannot be used as Work.',
}
