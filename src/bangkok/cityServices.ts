import { actors, type AdventureSave, type ActorId } from './adventure.ts';

export const cityServices = [
  {
    id: 'room',
    host: 'innkeeper',
    name: 'Rest in your room',
    cost: 0,
    phrase: 'thank-you',
    effect: 'Restore party health to 100 HP.',
    invitation: 'Mali has kept your room ready. Thank her for a place to rest.',
    result: 'You leave the room rested. Mali has put fresh water beside the guest book.',
  },
  {
    id: 'rice',
    host: 'cook',
    name: 'Rice parcel',
    cost: 10,
    phrase: 'want-this',
    effect: 'Pack one rice parcel. Use it to restore 45 HP.',
    invitation: 'Point to the wrapped rice parcel and tell Lek you would like this one.',
    result: 'Lek wraps a warm parcel for the road. One rice parcel added to your bag.',
  },
  {
    id: 'tea',
    host: 'gardener',
    name: 'Flask of Thai tea',
    cost: 8,
    phrase: 'want-this',
    effect: 'Pack one tea. Restore 20 HP and refill an ally’s AP in battle.',
    invitation: 'Pim has a flask ready for your walk. Point to it and say you would like this one.',
    result: 'Pim fills a flask and checks that the lid is tight. One tea added to your bag.',
  },
] as const;
export type CityServiceId = (typeof cityServices)[number]['id'];
export type ServiceHost = (typeof cityServices)[number]['host'];
export const serviceFor = (id: string) => cityServices.find((s) => s.id === id);
export const servicesForHost = (host: ActorId) => cityServices.filter((s) => s.host === host);
export function serviceReason(s: AdventureSave, id: string): string | null {
  const service = serviceFor(id);
  if (!service) return 'This service is unavailable.';
  if (s.battle) return 'Finish the encounter first.';
  if (!s.flags.includes(service.host)) return 'Meet this person and finish their first favour.';
  const host = actors.find((a) => a.id === service.host)!;
  if (Math.hypot(s.position.x - host.x, s.position.z - host.z) > 3) return 'Visit this person in the city.';
  if (s.coins < service.cost) return 'Not enough coins.';
  if (id === 'room' && s.hp >= 100) return 'Your party is already rested.';
  if ((id === 'rice' || id === 'tea') && s[id] >= 99) return 'Your bag holds 99 of this provision.';
  return null;
}
export function purchaseService(s: AdventureSave, id: CityServiceId): AdventureSave {
  if (serviceReason(s, id)) return s;
  const service = serviceFor(id)!;
  return { ...s, coins: s.coins - service.cost, ...(id === 'room' ? { hp: 100 } : { [id]: s[id] + 1 }) };
}
export function hostWelcome(s: AdventureSave, host: ServiceHost): string {
  if (host === 'innkeeper')
    return s.flags.includes('keeper')
      ? 'Mali has heard about the river lantern. She leaves your key on the desk. “You have a home here now. Come back whenever you need to rest.”'
      : 'Mali looks up from the guest book. “There you are, Patrick. Your room is ready. No charge—you have already checked in.”';
  if (host === 'cook')
    return s.flags.includes('ferry')
      ? '“Niran sent the empty bowl back,” Lek says, laughing. “That is his way of saying it was good. Shall I pack something for your next walk?”'
      : 'Lek ties a knot in the supper parcel. “Niran is waiting at the river. These smaller parcels are for your own journey.”';
  return s.flags.includes('murmur')
    ? 'The lakeside is quiet again. Pim sets a flask on the bench. “People have started walking here in the evening. You helped give the park back to them.”'
    : 'Pim takes a seat beside the pavilion. “You remembered the way back. A drink for the next part of your walk?”';
}
