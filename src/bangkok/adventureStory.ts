import type { ActorId } from './adventure';
export type StoryLine = { speaker: string; text: string; phrase?: string; response?: string; responseSpeaker?: string };
export const conversations: Partial<Record<ActorId, StoryLine[]>> = {
  station: [
    {
      speaker: 'Dao',
      text: 'Welcome to Sukhumvit. The trains run above the street, and the sois lead to small surprises. Before a trip, it helps to know how to get someone’s attention.',
      phrase: 'sorry',
      response: 'Dao turns towards you. A polite opening makes asking for help easier.',
    },
    {
      speaker: 'Dao',
      text: 'I explained that too quickly, didn’t I? Ask me to repeat it.',
      phrase: 'say-again',
      response: '“Explore on foot first. Then your city pass can bring you back to a familiar district.”',
    },
    {
      speaker: 'Dao',
      text: 'Here is a pass for your journeys with Su. Thank me, then try your city map. You can still walk everywhere.',
      phrase: 'thank-you',
      response: 'Return journeys are now available to districts you have visited. “There is also a brass waystone on the road to Yaowarat,” Dao adds. “Its guardian rewards travelers who work together. Look for it on your map when you feel ready.”',
    },
  ],
  gardener: [
    {
      speaker: 'Pim',
      text: 'Take a breath. Lumphini is a quiet pocket of trees and water inside a busy city. Are you thirsty after that walk?',
      phrase: 'i-am-thirsty',
      response: '“I thought you might be.” Pim reaches into her basket.',
    },
    {
      speaker: 'Pim',
      text: 'Ask for water. Simple needs are useful words to have ready before you travel.',
      phrase: 'water-please',
      response: 'Pim offers water, and packs a flask of tea for later.',
    },
    {
      speaker: 'Pim',
      text: 'The strange light beside the lake arrived with the mist. Be careful, and come back to rest whenever the city feels too loud.',
      phrase: 'thank-you',
      response: 'Pim waves as you set off. A small kindness to carry with you.',
    },
  ],
  artisan: [
    {
      speaker: 'Arun',
      text: 'Every lantern starts as a fragile frame. Choose that one so I can show you how it opens.',
      phrase: 'want-this',
      response: 'Arun unfolds a warm paper shade. “This little one will hold the light.”',
    },
    {
      speaker: 'Arun',
      text: 'A good traveller asks the price before agreeing to buy. Try asking me how much it is.',
      phrase: 'how-much',
      response: '“For you? Help me carry its story to the river. I’ll give you 15 coins for the errand.”',
    },
    {
      speaker: 'Arun',
      text: 'The tall lantern in this court is different. If you find a spark in Lumphini, it may wake again.',
      phrase: 'thank-you',
      response: '“Go carefully, Patrick. Words—and people—deserve patience.”',
    },
  ],
  su: [
    {
      speaker: 'Su',
      text: 'You are awake. This is your hotel on Sukhumvit, Patrick. Beyond the window is Bangkok—and something strange is stealing its words. I am Su. We can work this out together.',
    },
    {
      speaker: 'Su',
      text: 'The last ferry leaves at moonrise. Its lantern has gone dark. We need a spark, a little courage, and a few words people can understand.',
    },
    {
      speaker: 'Su',
      text: 'First, meet Mali at reception. Our room is the start of a much bigger journey. Walk with WASD or the arrow keys, or click the ground. Talk with E. The little map can guide you around obstacles.',
    },
  ],
  innkeeper: [
    {
      speaker: 'Mali',
      text: 'Another traveller from the rift! You look exhausted. Before we sort out your room, a greeting would be nice.',
      phrase: 'hello',
      response: 'Mali smiles and returns your greeting. The room feels a little less strange.',
    },
    {
      speaker: 'Mali',
      text: 'I am Mali. What should I call you?',
      phrase: 'my-name-is-patrick',
      response: '“Patrick. I will remember.” She turns the guest book towards you.',
    },
    {
      speaker: 'Mali',
      text: 'There is a reservation here with your name on it. Tell me you have a booking.',
      phrase: 'reservation-have',
      response: '“So this is yours!” Mali hands you an old brass key.',
    },
    {
      speaker: 'Mali',
      text: 'Rest here whenever you need. That key also opens the luggage chest beside reception. The door leads onto Sukhumvit. Uncle Lek in Yaowarat is making supper for our stranded ferryman—perhaps you could help.',
    },
  ],
  cook: [
    {
      speaker: 'Uncle Lek',
      text: 'Niran has been waiting at the pier all evening. Help me put his supper together. Point to this bowl and say you would like it.',
      phrase: 'want-this',
      response: 'Lek sets the bowl on the counter. “Good choice.”',
    },
    {
      speaker: 'Uncle Lek',
      text: 'Niran cannot handle much chilli. Tell me you want it not spicy.',
      phrase: 'not-spicy',
      response: 'The chilli jar goes back on the shelf. Lek gives you an approving nod.',
    },
    {
      speaker: 'Uncle Lek',
      text: 'A long wait makes a man thirsty. Ask for some water too.',
      phrase: 'water-please',
      response: 'A bottle joins the parcel. One small conversation, one real favour.',
    },
    {
      speaker: 'Uncle Lek',
      text: 'Take this supper to the pier. These two rice parcels are for you and Su—use them if the spirits wear you down. A wisp has been troubling people in Lumphini Park. You will find it beside the lake.',
    },
  ],
  ferry: [
    {
      speaker: 'Niran',
      text: 'Lek remembered! I was beginning to think I would spend the whole night here. He explains the broken lantern very quickly. Ask him to slow down.',
      phrase: 'speak-slowly',
      response: 'Niran slows down and points: Lumphini spark, Old Town lantern, clear passage.',
    },
    {
      speaker: 'Niran',
      text: 'A boat horn swallows his last sentence. Ask him to say it again.',
      phrase: 'say-again',
      response:
        '“Find the wisp in Lumphini. Take its spark to the lantern court in Old Town.” Now you have the plan.',
    },
    {
      speaker: 'Niran',
      text: 'Take this ferry pass. Restore the light and I will get you across. Thank him.',
      phrase: 'thank-you',
      response: 'Niran folds the pass into your hand. “I will keep two seats.”',
    },
  ],
};
export const spellIntent: Record<string, string> = {
  hello: 'Open a conversation. Say hello.',
  'thank-you': 'Someone has helped you. Thank them.',
  sorry: 'You bumped into someone. Apologise.',
  'water-please': 'Ask for drinking water.',
  'not-spicy': 'Order food without chilli heat.',
  'speak-slowly': 'Ask someone to speak more slowly.',
};
