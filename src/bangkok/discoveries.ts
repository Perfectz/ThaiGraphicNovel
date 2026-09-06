/** Optional stories found in the world, not handed out by the main quest marker. */
export const discoveries = [
  {
    id: 'hotel-journal',
    name: 'The traveller’s journal',
    x: -61,
    z: 34.5,
    color: '#dec58b',
    kind: 'book',
    area: 'hotel',
    phrase: 'my-name-is-patrick',
    hint: 'Look beyond your bed, near the back corner of your room.',
    story:
      'A guest has left a journal for the next traveller. The first page says: “I spent my first morning afraid to speak. By evening, the noodle seller knew my name.” There is space beneath it for yours.',
    response:
      'Su writes your introduction beneath the other travellers. A small envelope inside is marked “For your first city day.”',
    rice: 0,
    tea: 0,
    coins: 10,
  },
  {
    id: 'soi-route',
    name: 'The hand-drawn soi map',
    x: -57,
    z: 17.5,
    color: '#9fcce0',
    kind: 'board',
    area: 'sukhumvit',
    phrase: 'where-is-station',
    hint: 'A hand-drawn board stands in the western soi, away from Dao’s platform.',
    story:
      'Behind the main street, a shopkeeper has drawn a tiny map. A train runs across its top; below it are a tailor, a food cart and a dog asleep in the shade. The route makes sense once you know what to ask.',
    response:
      'Su follows your question with her finger, tracing the way to Dao. On the board, a note offers a few coins to travellers who help keep these small routes remembered.',
    rice: 0,
    tea: 0,
    coins: 10,
  },
  {
    id: 'park-basket',
    name: 'Pim’s volunteer basket',
    x: -13.5,
    z: 35,
    color: '#a6cc99',
    kind: 'basket',
    area: 'lumphini',
    phrase: 'water-please',
    hint: 'Follow the lakeside path past the eastern trees.',
    story:
      'A woven basket rests beside the lakeside path. Pim’s note reads: “For anyone who walked further than they planned. Please take a drink.” The city sounds softer here. Su asks how you would request water.',
    response:
      'You practise the request. Beneath the drinking water is a sealed flask of Thai tea, left for the next tired traveller. You tuck it into your bag.',
    rice: 0,
    tea: 1,
    coins: 0,
  },
  {
    id: 'market-recipe',
    name: 'The family recipe board',
    x: 48.5,
    z: 16.5,
    color: '#eda782',
    kind: 'board',
    area: 'yaowarat',
    phrase: 'not-spicy',
    hint: 'Follow the red lanterns to the eastern end of the food stalls.',
    story:
      'An old recipe board carries three generations of handwritten changes. A small serving is set aside for a traveller. Su points to the chilli jar: “Make the meal yours. Tell the cook how you want it.”',
    response:
      'You ask for no chilli. The stallholder nods and wraps two rice parcels for the road. The recipe board gains another small note: a meal is a conversation, too.',
    rice: 2,
    tea: 0,
    coins: 0,
  },
  {
    id: 'river-keepsake',
    name: 'The ferryman’s keepsake',
    x: -9.5,
    z: 4.5,
    color: '#95d4cc',
    kind: 'boat',
    area: 'riverside',
    phrase: 'see-you',
    hint: 'Search the western edge of the riverside court, before the pier.',
    story:
      'A carved wooden boat sits on a low plinth. Niran’s note says his daughter made it before she moved across the city. Under the hull she wrote a promise to visit. Su asks you to practise a goodbye that leaves the door open.',
    response:
      '“See you.” The words feel different beside the river. You leave the little boat where it belongs and accept the tea Niran has set out for visitors.',
    rice: 0,
    tea: 1,
    coins: 0,
  },
  {
    id: 'artisan-lantern',
    name: 'The unfinished lantern',
    x: 47.5,
    z: 30.5,
    color: '#dcc19b',
    kind: 'lantern',
    area: 'oldtown',
    phrase: 'what-material',
    hint: 'Explore the court east of Arun’s workshop, beside the temple wall.',
    story:
      'An unfinished lantern reveals the frame beneath its paper. Arun has left sample pieces for visitors to handle. Su smiles: “You do not need to know every word. A good question is enough to begin.”',
    response:
      'You ask what it is made from. A workshop note explains the frame and covering, then invites you to take a small travel allowance for helping preserve the lantern trail.',
    rice: 0,
    tea: 0,
    coins: 15,
  },
] as const;
export type DiscoveryId = (typeof discoveries)[number]['id'];
export const discoveryFor = (id: string) => discoveries.find((d) => d.id === id);
export const discoveryCount = (flags: string[]) => discoveries.filter((d) => flags.includes(d.id)).length;
export const hasRiverCharm = (flags: string[]) => discoveryCount(flags) === discoveries.length;
