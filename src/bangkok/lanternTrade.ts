import { actors, type AdventureSave } from './adventure.ts';

export type LanternOffer = 'new' | 'carved' | 'discount' | 'paper';
export type LanternTrade = { offer: LanternOffer; owned: 'carved' | 'paper' | null; paid: number };
export const freshLanternTrade = (): LanternTrade => ({ offer: 'new', owned: null, paid: 0 });
export const lanternPrices: Record<LanternOffer, number> = { new: 30, carved: 30, discount: 24, paper: 18 };
export function normalizeLanternTrade(value: unknown): LanternTrade {
  if (!value || typeof value !== 'object') return freshLanternTrade();
  const trade = value as Partial<LanternTrade>;
  const offer = ['new', 'carved', 'discount', 'paper'].includes(trade.offer ?? '') ? trade.offer! : 'new';
  if (trade.owned === 'carved' && (trade.paid === 30 || trade.paid === 24))
    return { offer: trade.paid === 24 ? 'discount' : 'carved', owned: 'carved', paid: trade.paid };
  if (trade.owned === 'paper' && trade.paid === 18) return { offer: 'paper', owned: 'paper', paid: 18 };
  return { offer, owned: null, paid: 0 };
}
export const lanternRevealRadius = (trade: LanternTrade) => (trade.owned ? 14 : 8);
export const lanternName = (trade: LanternTrade) =>
  (trade.owned ?? (trade.offer === 'paper' ? 'paper' : 'carved')) === 'paper'
    ? 'Paper travel lantern'
    : 'Carved travel lantern';
export function lanternChoices(offer: LanternOffer): string[] {
  if (offer === 'new') return ['how-much', 'think-first'];
  if (offer === 'paper') return ['i-will-buy', 'how-much', 'think-first'];
  return ['i-will-buy', ...(offer === 'carved' ? ['little-cheaper'] : []), 'too-expensive', 'not-today'];
}
export function lanternTradeReason(save: AdventureSave): string | null {
  if (save.battle) return 'Finish the encounter first.';
  if (save.journeys.active && !save.journeys.active.paused)
    return 'Pause your travel mission before browsing.';
  if (!save.flags.includes('innkeeper') || !save.flags.includes('artisan'))
    return 'Meet Arun and finish his first conversation.';
  if (save.lantern.owned) return 'Your travel lantern is already in the party’s bag.';
  const host = actors.find((actor) => actor.id === 'artisan')!;
  return Math.hypot(save.position.x - host.x, save.position.z - host.z) > 3
    ? 'Visit Arun’s workshop in Old Town.'
    : null;
}
export function lanternReplyReason(save: AdventureSave, reply: string): string | null {
  const reason = lanternTradeReason(save);
  if (reason) return reason;
  if (!lanternChoices(save.lantern.offer).includes(reply)) return 'Ask about the current offer first.';
  if (reply === 'i-will-buy' && save.coins < lanternPrices[save.lantern.offer])
    return `You need ${lanternPrices[save.lantern.offer] - save.coins} more game coins for this lantern.`;
  return null;
}
export const leavesLanternTrade = (reply: string) => reply === 'think-first' || reply === 'not-today';

/** Only a confirmed reply changes the quote; only confirming a purchase spends coins. */
export function advanceLanternTrade(
  save: AdventureSave,
  expected: LanternOffer,
  reply: string,
): AdventureSave {
  if (save.lantern.offer !== expected || lanternReplyReason(save, reply) || leavesLanternTrade(reply))
    return save;
  if (reply === 'i-will-buy') {
    const price = lanternPrices[save.lantern.offer];
    return {
      ...save,
      coins: save.coins - price,
      xp: save.xp + 40,
      lantern: { ...save.lantern, owned: save.lantern.offer === 'paper' ? 'paper' : 'carved', paid: price },
    };
  }
  const offer = reply === 'how-much' ? 'carved' : reply === 'little-cheaper' ? 'discount' : 'paper';
  return { ...save, lantern: { offer, owned: null, paid: 0 } };
}
export function lanternScene(trade: LanternTrade) {
  if (trade.offer === 'new')
    return 'A little lantern hangs above Arun’s bench. “For the side paths,” he says. Su turns its carved frame in the light. Before deciding, find out what it costs.';
  if (trade.offer === 'carved')
    return '“Thirty coins for the carved lantern.” Arun leaves it on the bench while you decide. You can accept, politely ask for a lower price, or explain that it is too expensive.';
  if (trade.offer === 'discount')
    return '“Twenty-four, then. I made the carving myself, so that is my best price.” Arun smiles. You can accept his offer, ask about something within your budget, or leave.';
  return '“This paper lantern is eighteen coins. Same light, simpler frame.” Arun puts it beside the carved one. Take the simpler lantern, ask the carved lantern’s price again, or think it over and return later.';
}
export function lanternConsequence(trade: LanternTrade, reply: string): string {
  if (reply === 'how-much') return 'Arun will quote 30 game coins. Asking the price does not buy anything.';
  if (reply === 'little-cheaper')
    return 'Arun will lower the carved lantern to 24 game coins. You still decide whether to buy.';
  if (reply === 'too-expensive')
    return 'Arun will offer a simpler paper lantern for 18 game coins. Both lanterns reveal city memories from farther away.';
  if (leavesLanternTrade(reply))
    return 'Leave with your coins. Arun will remember the offer when you return.';
  return `Spend ${lanternPrices[trade.offer]} game coins on the ${trade.offer === 'paper' ? 'paper' : 'carved'} lantern. Su carries it on your travels; hidden city memories become visible from farther away. Receive 40 XP once.`;
}
