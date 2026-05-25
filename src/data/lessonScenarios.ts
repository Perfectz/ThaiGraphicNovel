import { type ThaiPhrase } from './thaiPhrases';

export type EquipmentSlot = 'Weapon' | 'Armor' | 'Accessory' | 'Relic';

export type EquipmentItem = {
  id: string;
  slot: EquipmentSlot;
  name: string;
  effect: string;
};

export type SuperMove = {
  id: string;
  name: string;
  chargeRule: string;
  effect: string;
};

export type LessonChunk = {
  id: string;
  title: string;
  focus: string;
  objective: string;
  phrases: ThaiPhrase[];
};

export type LessonScenario = {
  id: string;
  scenarioNumber: number;
  title: string;
  location: string;
  difficulty: string;
  storyGoal: string;
  lessonGoal: string;
  equipmentReward: EquipmentItem;
  superMove: SuperMove;
  chunks: LessonChunk[];
};

export const lessonScenarios: LessonScenario[] = [
  {
    id: 'hotel-lobby-basics',
    scenarioNumber: 1,
    title: 'Hotel Lobby Basics',
    location: 'Chao Phraya Star Hotel',
    difficulty: 'Starter',
    storyGoal: 'Su stabilizes Patrick after the Bangkok rift and teaches polite survival phrases.',
    lessonGoal:
      'Open a polite conversation, introduce yourself, ask basic help questions, and heal with thirst.',
    equipmentReward: {
      id: 'traveler-notebook',
      slot: 'Weapon',
      name: "Traveler's Notebook",
      effect: 'Starter weapon. Clear pronunciation builds Understanding.',
    },
    superMove: {
      id: 'wai-of-clarity',
      name: 'Wai of Clarity',
      chargeRule: 'Pass 3 phrases in the current lesson.',
      effect: 'Spend full charge to restore Courage and shake Su loose from hesitation.',
    },
    chunks: [
      {
        id: 'first-contact',
        title: 'First Contact',
        focus: 'Start politely',
        objective: 'Greet Su and introduce yourself without panic.',
        phrases: [
          {
            id: 'hello',
            lesson: 'Greeting magic',
            targetPhrase: 'สวัสดีครับ',
            romanization: 'sawatdee khrap',
            phoneticSpelling: 'sah-waht-dee krahp',
            translation: 'Hello',
            context: 'Su teaches this as the safe way to open almost any polite conversation.',
            example: 'Use it when Patrick first meets someone in magical Bangkok.',
          },
          {
            id: 'my-name-is-patrick',
            lesson: 'Say your name',
            targetPhrase: 'ผมชื่อแพทริกครับ',
            romanization: 'phom chue Patrick khrap',
            phoneticSpelling: 'pohm cheu Patrick krahp',
            translation: 'My name is Patrick',
            context: 'A basic self-introduction that keeps the polite male ending.',
            example: 'Use it when a new NPC asks who fell through the rift.',
          },
          {
            id: 'nice-to-meet-you',
            lesson: 'Meet kindly',
            targetPhrase: 'ยินดีที่ได้รู้จักครับ',
            romanization: 'yin dee tee dai roo jak khrap',
            phoneticSpelling: 'yin dee tee dai roo jahk krahp',
            translation: 'Nice to meet you',
            context: 'A friendly phrase after introductions.',
            example: 'Use it after Su tells Patrick her name.',
          },
        ],
      },
      {
        id: 'polite-repair',
        title: 'Polite Repair',
        focus: 'Respect and fixes',
        objective: 'Say thanks, apologize, and answer yes or no.',
        phrases: [
          {
            id: 'thank-you',
            lesson: 'Show gratitude',
            targetPhrase: 'ขอบคุณครับ',
            romanization: 'khop khun khrap',
            phoneticSpelling: 'kawp koon krahp',
            translation: 'Thank you',
            context: 'Su calls this one essential. Gratitude keeps conversations kind.',
            example: 'Use it whenever Su helps Patrick pronounce something correctly.',
          },
          {
            id: 'sorry',
            lesson: 'Repair mistakes',
            targetPhrase: 'ขอโทษครับ',
            romanization: 'kho thot khrap',
            phoneticSpelling: 'kaw tote krahp',
            translation: 'Sorry / excuse me',
            context: 'Use this for mistakes, interruptions, or getting attention politely.',
            example: 'Use it when Patrick bumps into luggage or interrupts someone.',
          },
          {
            id: 'yes',
            lesson: 'Confirm clearly',
            targetPhrase: 'ใช่ครับ',
            romanization: 'chai khrap',
            phoneticSpelling: 'chai krahp',
            translation: 'Yes',
            context: 'A polite confirmation.',
            example: 'Use it when Su asks if Patrick is ready.',
          },
          {
            id: 'no',
            lesson: 'Decline clearly',
            targetPhrase: 'ไม่ใช่ครับ',
            romanization: 'mai chai khrap',
            phoneticSpelling: 'my chai krahp',
            translation: 'No / not correct',
            context: 'A simple correction or negative answer.',
            example: 'Use it when a clerk guesses the wrong room.',
          },
        ],
      },
      {
        id: 'first-needs',
        title: 'First Needs',
        focus: 'Ask for essentials',
        objective: 'Ask a price, find the bathroom, and heal by saying you are thirsty.',
        phrases: [
          {
            id: 'how-much',
            lesson: 'Ask the price',
            targetPhrase: 'ราคาเท่าไหร่ครับ',
            romanization: 'raa khaa tao rai khrap',
            phoneticSpelling: 'rah kah tao rye krahp',
            translation: 'How much is it?',
            context: 'The first practical market question.',
            example: 'Use it before buying water or a charm.',
          },
          {
            id: 'bathroom-where',
            lesson: 'Find the bathroom',
            targetPhrase: 'ห้องน้ำอยู่ที่ไหนครับ',
            romanization: 'hong nam yoo tee nai khrap',
            phoneticSpelling: 'hawng nahm yoo tee nye krahp',
            translation: 'Where is the bathroom?',
            context: 'A survival phrase for hotels, malls, stations, and restaurants.',
            example: 'Use it when Patrick gets lost in the lobby.',
          },
          {
            id: 'i-am-thirsty',
            lesson: 'Heal with water',
            targetPhrase: 'ผมหิวน้ำครับ',
            romanization: 'phom hiw naam khrap',
            phoneticSpelling: 'pohm hew nahm krahp',
            translation: 'I am thirsty',
            context: 'This phrase restores Courage because Patrick asks for what he needs.',
            example: 'Use it when the battle pressure drains Patrick.',
            phraseEffect: 'heal',
          },
        ],
      },
    ],
  },
  {
    id: 'front-desk-check-in',
    scenarioNumber: 2,
    title: 'Front Desk Check-in',
    location: 'Hotel front desk',
    difficulty: 'Beginner',
    storyGoal: 'Patrick claims a room key while the desk clerk speaks faster than expected.',
    lessonGoal: 'Handle check-in, reservations, room numbers, and slower repetition.',
    equipmentReward: {
      id: 'keycard-buckler',
      slot: 'Armor',
      name: 'Keycard Buckler',
      effect: 'Reduces Courage loss when asking someone to repeat themselves.',
    },
    superMove: {
      id: 'slow-speech-barrier',
      name: 'Slow Speech Barrier',
      chargeRule: 'Pass the check-in, room, and repeat chunks.',
      effect: 'Forces the next NPC line into slower, clearer Thai.',
    },
    chunks: [
      {
        id: 'reservation',
        title: 'Reservation',
        focus: 'Check in',
        objective: 'Tell the clerk you have a reservation and give your name.',
        phrases: [
          phrase(
            'reservation-have',
            'จองไว้ครับ',
            'jong wai khrap',
            'I have a reservation',
            'Use this at the front desk.',
          ),
          phrase(
            'under-name',
            'ชื่อแพทริกครับ',
            'chue Patrick khrap',
            'The name is Patrick',
            'Use this when the clerk checks the booking.',
          ),
          phrase(
            'check-in-please',
            'ขอเช็กอินครับ',
            'kho check in khrap',
            'I would like to check in',
            'Use this to start the hotel check-in.',
          ),
        ],
      },
      {
        id: 'room-key',
        title: 'Room Key',
        focus: 'Room details',
        objective: 'Ask about the key, floor, and room location.',
        phrases: [
          phrase(
            'key-where',
            'กุญแจอยู่ที่ไหนครับ',
            'gun jae yoo tee nai khrap',
            'Where is the key?',
            'Use this when the key is not obvious.',
          ),
          phrase(
            'which-floor',
            'ห้องผมอยู่ชั้นไหนครับ',
            'hong phom yoo chan nai khrap',
            'Which floor is my room on?',
            'Use this after receiving a room number.',
          ),
          phrase(
            'elevator-where',
            'ลิฟต์อยู่ที่ไหนครับ',
            'lift yoo tee nai khrap',
            'Where is the elevator?',
            'Use this before leaving the desk.',
          ),
        ],
      },
      {
        id: 'slow-repeat',
        title: 'Slow Repeat',
        focus: 'Repair confusion',
        objective: 'Ask for slower speech and repetition.',
        phrases: [
          phrase(
            'speak-slowly',
            'ช่วยพูดช้าลงหน่อยครับ',
            'chuai phuut chaa long noi khrap',
            'Please speak more slowly',
            'Use this when the clerk speaks too fast.',
          ),
          phrase(
            'say-again',
            'พูดอีกครั้งได้ไหมครับ',
            'phuut eek khrang dai mai khrap',
            'Can you say that again?',
            'Use this to request a repeat.',
          ),
          phrase(
            'i-understand',
            'เข้าใจแล้วครับ',
            'khao jai laeo khrap',
            'I understand now',
            'Use this after the meaning clicks.',
          ),
        ],
      },
    ],
  },
  {
    id: 'street-food-order',
    scenarioNumber: 3,
    title: 'Street Food Order',
    location: 'Night market food stall',
    difficulty: 'Beginner Plus',
    storyGoal: 'Su helps Patrick order dinner without accidentally summoning ghost chilies.',
    lessonGoal: 'Order food, ask spice level, request water, and pay.',
    equipmentReward: {
      id: 'spoon-saber',
      slot: 'Weapon',
      name: 'Spoon Saber',
      effect: 'Adds bonus Understanding when food phrases are spoken clearly.',
    },
    superMove: {
      id: 'mai-phet-guard',
      name: 'Mai Phet Guard',
      chargeRule: 'Pass 3 food phrases.',
      effect: 'Blocks one spicy mistake and restores Courage.',
    },
    chunks: [
      {
        id: 'choose-food',
        title: 'Choose Food',
        focus: 'Ordering',
        objective: 'Ask for food and point to one dish.',
        phrases: [
          phrase(
            'want-this',
            'เอาอันนี้ครับ',
            'ao an nee khrap',
            'I will take this one',
            'Use this while pointing at a dish.',
          ),
          phrase(
            'what-is-this',
            'อันนี้คืออะไรครับ',
            'an nee kheu arai khrap',
            'What is this?',
            'Use this before ordering mystery food.',
          ),
          phrase(
            'one-plate',
            'ขอหนึ่งจานครับ',
            'kho nueng jaan khrap',
            'One plate, please',
            'Use this for a single serving.',
          ),
        ],
      },
      {
        id: 'spice-control',
        title: 'Spice Control',
        focus: 'Preferences',
        objective: 'Control heat and mention allergies or limits.',
        phrases: [
          phrase(
            'not-spicy',
            'ไม่เผ็ดครับ',
            'mai phet khrap',
            'Not spicy, please',
            'Use this to avoid too much heat.',
          ),
          phrase(
            'little-spicy',
            'เผ็ดนิดหน่อยครับ',
            'phet nit noi khrap',
            'A little spicy',
            'Use this when Patrick is feeling brave.',
          ),
          phrase(
            'no-peanuts',
            'ไม่เอาถั่วครับ',
            'mai ao thua khrap',
            'No peanuts, please',
            'Use this for a simple food restriction.',
          ),
        ],
      },
      {
        id: 'pay-and-water',
        title: 'Pay and Water',
        focus: 'Closing the order',
        objective: 'Ask for water, pay, and thank the vendor.',
        phrases: [
          phrase(
            'water-please',
            'ขอน้ำเปล่าครับ',
            'kho naam plao khrap',
            'Water, please',
            'Use this with spicy food.',
          ),
          phrase(
            'bill-please',
            'คิดเงินด้วยครับ',
            'khit ngoen duai khrap',
            'Bill, please',
            'Use this when ready to pay.',
          ),
          phrase(
            'delicious',
            'อร่อยมากครับ',
            'a roi maak khrap',
            'Very delicious',
            'Use this as a friendly compliment.',
          ),
        ],
      },
    ],
  },
  {
    id: 'taxi-ride',
    scenarioNumber: 4,
    title: 'Taxi Ride Across Bangkok',
    location: 'Taxi and tuk-tuk stand',
    difficulty: 'Lower Intermediate',
    storyGoal: 'Patrick must reach the shrine before the rift closes.',
    lessonGoal: 'Give destinations, ask about meters, traffic, and arrival time.',
    equipmentReward: {
      id: 'compass-amulet',
      slot: 'Accessory',
      name: 'Compass Amulet',
      effect: 'Improves direction phrases and reduces confusion damage.',
    },
    superMove: {
      id: 'meter-flare',
      name: 'Meter Flare',
      chargeRule: 'Pass destination and price phrases.',
      effect: 'Reveals the fair route and prevents one overcharge.',
    },
    chunks: [
      {
        id: 'destination',
        title: 'Destination',
        focus: 'Where to go',
        objective: 'Tell the driver your destination.',
        phrases: [
          phrase(
            'go-to-shrine',
            'ไปวัดนี้ครับ',
            'pai wat nee khrap',
            'Please go to this temple',
            'Use this while showing the map.',
          ),
          phrase(
            'go-hotel',
            'ไปโรงแรมนี้ครับ',
            'pai rong raem nee khrap',
            'Please go to this hotel',
            'Use this for the return trip.',
          ),
          phrase(
            'near-here',
            'อยู่ใกล้ไหมครับ',
            'yoo glai mai khrap',
            'Is it nearby?',
            'Use this before choosing a ride.',
          ),
        ],
      },
      {
        id: 'fare',
        title: 'Fare',
        focus: 'Price and meter',
        objective: 'Ask for a meter and confirm price.',
        phrases: [
          phrase(
            'use-meter',
            'เปิดมิเตอร์ได้ไหมครับ',
            'poet mee ter dai mai khrap',
            'Can you use the meter?',
            'Use this in a taxi.',
          ),
          phrase(
            'how-much-to-go',
            'ไปที่นั่นเท่าไหร่ครับ',
            'pai tee nan tao rai khrap',
            'How much to go there?',
            'Use this before a tuk-tuk ride.',
          ),
          phrase(
            'too-expensive',
            'แพงไปครับ',
            'phaeng pai khrap',
            'That is too expensive',
            'Use this when negotiating politely.',
          ),
        ],
      },
      {
        id: 'route-time',
        title: 'Route Time',
        focus: 'Traffic and arrival',
        objective: 'Ask about traffic and timing.',
        phrases: [
          phrase(
            'traffic-heavy',
            'รถติดไหมครับ',
            'rot tit mai khrap',
            'Is there traffic?',
            'Use this during rush hour.',
          ),
          phrase(
            'how-long',
            'ใช้เวลานานแค่ไหนครับ',
            'chai wela naan khae nai khrap',
            'How long will it take?',
            'Use this before committing to the ride.',
          ),
          phrase(
            'stop-here',
            'จอดตรงนี้ครับ',
            'jot trong nee khrap',
            'Please stop here',
            'Use this when arriving.',
          ),
        ],
      },
    ],
  },
  {
    id: 'market-bargain',
    scenarioNumber: 5,
    title: 'Market Bargain',
    location: 'Floating market charm shop',
    difficulty: 'Intermediate',
    storyGoal: 'Patrick buys protective gear while learning how to negotiate respectfully.',
    lessonGoal: 'Ask sizes, colors, discounts, and make polite choices.',
    equipmentReward: {
      id: 'silk-vest',
      slot: 'Armor',
      name: 'Silk Vest',
      effect: 'Raises max Courage after polite negotiation wins.',
    },
    superMove: {
      id: 'discount-combo',
      name: 'Discount Combo',
      chargeRule: 'Pass price, choice, and polite refusal chunks.',
      effect: 'Converts a hard bargain into a friendly deal.',
    },
    chunks: [
      {
        id: 'browse',
        title: 'Browse',
        focus: 'Shopping questions',
        objective: 'Ask what something is and whether you can see it.',
        phrases: [
          phrase(
            'can-see',
            'ขอดูได้ไหมครับ',
            'kho doo dai mai khrap',
            'May I see it?',
            'Use this before handling an item.',
          ),
          phrase(
            'what-material',
            'ทำจากอะไรครับ',
            'tham jaak arai khrap',
            'What is it made from?',
            'Use this for gear and charms.',
          ),
          phrase(
            'has-color',
            'มีสีอื่นไหมครับ',
            'mee see eun mai khrap',
            'Do you have another color?',
            'Use this when choosing style.',
          ),
        ],
      },
      {
        id: 'bargain',
        title: 'Bargain',
        focus: 'Discounts',
        objective: 'Ask for a better price without being rude.',
        phrases: [
          phrase(
            'discount',
            'ลดราคาได้ไหมครับ',
            'lot raa khaa dai mai khrap',
            'Can you lower the price?',
            'Use this to bargain politely.',
          ),
          phrase(
            'little-cheaper',
            'ถูกกว่านี้ได้ไหมครับ',
            'thuuk gwaa nee dai mai khrap',
            'Can it be cheaper than this?',
            'Use this after hearing the price.',
          ),
          phrase(
            'buy-two',
            'ซื้อสองชิ้นลดได้ไหมครับ',
            'sue song chin lot dai mai khrap',
            'If I buy two, can you discount it?',
            'Use this for bundle bargaining.',
          ),
        ],
      },
      {
        id: 'decide',
        title: 'Decide',
        focus: 'Accept or decline',
        objective: 'Buy, decline, or keep looking politely.',
        phrases: [
          phrase(
            'i-will-buy',
            'ผมเอาอันนี้ครับ',
            'phom ao an nee khrap',
            'I will take this one',
            'Use this to purchase.',
          ),
          phrase(
            'think-first',
            'ขอคิดดูก่อนครับ',
            'kho khit doo gon khrap',
            'Let me think first',
            'Use this to pause politely.',
          ),
          phrase(
            'not-today',
            'วันนี้ยังไม่เอาครับ',
            'wan nee yang mai ao khrap',
            'Not today, thanks',
            'Use this to decline.',
          ),
        ],
      },
    ],
  },
  {
    id: 'clinic-and-pharmacy',
    scenarioNumber: 6,
    title: 'Clinic and Pharmacy',
    location: 'Neighborhood pharmacy',
    difficulty: 'Intermediate Plus',
    storyGoal: 'Patrick must explain symptoms after a cursed mango drink backfires.',
    lessonGoal: 'Describe pain, ask for medicine, give timing, and understand warnings.',
    equipmentReward: {
      id: 'first-aid-charm',
      slot: 'Accessory',
      name: 'First Aid Charm',
      effect: 'Improves healing phrases and increases Courage recovery.',
    },
    superMove: {
      id: 'symptom-scan',
      name: 'Symptom Scan',
      chargeRule: 'Pass symptom, medicine, and timing phrases.',
      effect: 'Identifies the safest recovery phrase in a lesson.',
    },
    chunks: [
      {
        id: 'symptoms',
        title: 'Symptoms',
        focus: 'Health status',
        objective: 'Describe common symptoms simply.',
        phrases: [
          phrase(
            'stomach-hurts',
            'ปวดท้องครับ',
            'puat thong khrap',
            'My stomach hurts',
            'Use this at a clinic or pharmacy.',
          ),
          phrase(
            'headache',
            'ปวดหัวครับ',
            'puat hua khrap',
            'I have a headache',
            'Use this for common pain.',
          ),
          phrase('fever', 'มีไข้ครับ', 'mee khai khrap', 'I have a fever', 'Use this when feeling sick.'),
        ],
      },
      {
        id: 'medicine',
        title: 'Medicine',
        focus: 'Ask for help',
        objective: 'Ask what medicine to take.',
        phrases: [
          phrase(
            'need-medicine',
            'ต้องกินยาอะไรครับ',
            'tong gin yaa arai khrap',
            'What medicine should I take?',
            'Use this with a pharmacist.',
          ),
          phrase(
            'have-allergy',
            'ผมแพ้ยานี้ครับ',
            'phom phae yaa nee khrap',
            'I am allergic to this medicine',
            'Use this for safety.',
          ),
          phrase(
            'side-effects',
            'มีผลข้างเคียงไหมครับ',
            'mee phon khang khiang mai khrap',
            'Are there side effects?',
            'Use this before taking medicine.',
          ),
        ],
      },
      {
        id: 'timing',
        title: 'Timing',
        focus: 'Instructions',
        objective: 'Understand dosage and timing.',
        phrases: [
          phrase(
            'how-many-times',
            'กินวันละกี่ครั้งครับ',
            'gin wan la gee khrang khrap',
            'How many times per day?',
            'Use this for dosage.',
          ),
          phrase(
            'after-food',
            'กินหลังอาหารใช่ไหมครับ',
            'gin lang aa haan chai mai khrap',
            'Take it after food, right?',
            'Use this to confirm instructions.',
          ),
          phrase(
            'feel-better',
            'ดีขึ้นแล้วครับ',
            'dee kheun laeo khrap',
            'I feel better now',
            'Use this after healing.',
          ),
        ],
      },
    ],
  },
  {
    id: 'friendship-plans',
    scenarioNumber: 7,
    title: 'Friendship Plans',
    location: 'Riverside cafe',
    difficulty: 'Upper Intermediate',
    storyGoal: 'Su introduces Patrick to friends who invite him into normal Bangkok life.',
    lessonGoal: 'Make plans, talk about likes, availability, and polite invitations.',
    equipmentReward: {
      id: 'friendship-ring',
      slot: 'Relic',
      name: 'Friendship Ring',
      effect: 'Boosts social phrases and unlocks warmer NPC responses.',
    },
    superMove: {
      id: 'invitation-chain',
      name: 'Invitation Chain',
      chargeRule: 'Pass preference, time, and invitation chunks.',
      effect: 'Links three social phrases into one smooth exchange.',
    },
    chunks: [
      {
        id: 'likes',
        title: 'Likes',
        focus: 'Preferences',
        objective: 'Talk about what you like and do not like.',
        phrases: [
          phrase(
            'like-coffee',
            'ผมชอบกาแฟครับ',
            'phom chop gaa fae khrap',
            'I like coffee',
            'Use this at a cafe.',
          ),
          phrase(
            'like-thai-food',
            'ผมชอบอาหารไทยครับ',
            'phom chop aa haan Thai khrap',
            'I like Thai food',
            'Use this when chatting about food.',
          ),
          phrase(
            'not-like-spicy',
            'ผมไม่ค่อยชอบเผ็ดครับ',
            'phom mai khoi chop phet khrap',
            'I do not really like spicy food',
            'Use this carefully and politely.',
          ),
        ],
      },
      {
        id: 'time',
        title: 'Time',
        focus: 'Availability',
        objective: 'Ask when people are free.',
        phrases: [
          phrase(
            'free-when',
            'ว่างเมื่อไหร่ครับ',
            'waang muea rai khrap',
            'When are you free?',
            'Use this to plan.',
          ),
          phrase(
            'free-evening',
            'เย็นนี้ว่างครับ',
            'yen nee waang khrap',
            'I am free this evening',
            'Use this to offer a time.',
          ),
          phrase(
            'tomorrow-ok',
            'พรุ่งนี้ได้ไหมครับ',
            'phrung nee dai mai khrap',
            'Is tomorrow okay?',
            'Use this to reschedule.',
          ),
        ],
      },
      {
        id: 'invite',
        title: 'Invite',
        focus: 'Making plans',
        objective: 'Invite someone and confirm the plan.',
        phrases: [
          phrase(
            'go-together',
            'ไปด้วยกันไหมครับ',
            'pai duai gan mai khrap',
            'Shall we go together?',
            'Use this for an invitation.',
          ),
          phrase(
            'meet-where',
            'เจอกันที่ไหนครับ',
            'jer gan tee nai khrap',
            'Where should we meet?',
            'Use this to set the place.',
          ),
          phrase(
            'see-you',
            'แล้วเจอกันครับ',
            'laeo jer gan khrap',
            'See you then',
            'Use this to close the plan.',
          ),
        ],
      },
    ],
  },
  {
    id: 'directions-and-emergency',
    scenarioNumber: 8,
    title: 'Directions and Emergency',
    location: 'Lost alley near the shrine',
    difficulty: 'Advanced',
    storyGoal: 'A rift storm scatters the party and Patrick must ask strangers for urgent help.',
    lessonGoal: 'Ask directions, report a problem, and request urgent help.',
    equipmentReward: {
      id: 'map-cloak',
      slot: 'Armor',
      name: 'Map Cloak',
      effect: 'Prevents one wrong-turn penalty in direction lessons.',
    },
    superMove: {
      id: 'emergency-beacon',
      name: 'Emergency Beacon',
      chargeRule: 'Pass all urgent-help phrases in a row.',
      effect: 'Summons Su guidance and marks the correct route.',
    },
    chunks: [
      {
        id: 'directions',
        title: 'Directions',
        focus: 'Navigation',
        objective: 'Ask where places are and how to get there.',
        phrases: [
          phrase(
            'where-is-station',
            'สถานีอยู่ที่ไหนครับ',
            'sa thaa nee yoo tee nai khrap',
            'Where is the station?',
            'Use this when lost.',
          ),
          phrase(
            'go-how',
            'ไปยังไงครับ',
            'pai yang ngai khrap',
            'How do I get there?',
            'Use this after naming a destination.',
          ),
          phrase(
            'turn-left-right',
            'เลี้ยวซ้ายหรือขวาครับ',
            'liao saai rue khwaa khrap',
            'Turn left or right?',
            'Use this to confirm a direction.',
          ),
        ],
      },
      {
        id: 'problem',
        title: 'Problem',
        focus: 'Explain trouble',
        objective: 'Say you are lost or need help.',
        phrases: [
          phrase(
            'i-am-lost',
            'ผมหลงทางครับ',
            'phom long thaang khrap',
            'I am lost',
            'Use this in an emergency.',
          ),
          phrase(
            'phone-dead',
            'โทรศัพท์แบตหมดครับ',
            'tho ra sap baet mot khrap',
            'My phone battery is dead',
            'Use this when you cannot navigate.',
          ),
          phrase(
            'friend-missing',
            'เพื่อนผมหายครับ',
            'phuean phom haai khrap',
            'My friend is missing',
            'Use this if separated.',
          ),
        ],
      },
      {
        id: 'urgent-help',
        title: 'Urgent Help',
        focus: 'Get assistance',
        objective: 'Ask for help, police, or a hospital.',
        phrases: [
          phrase(
            'please-help',
            'ช่วยผมด้วยครับ',
            'chuai phom duai khrap',
            'Please help me',
            'Use this when urgent.',
          ),
          phrase(
            'call-police',
            'ช่วยโทรหาตำรวจให้หน่อยครับ',
            'chuai tho haa tam ruat hai noi khrap',
            'Please call the police for me',
            'Use this for serious trouble.',
          ),
          phrase(
            'need-hospital',
            'ผมต้องไปโรงพยาบาลครับ',
            'phom tong pai rong pha ya baan khrap',
            'I need to go to the hospital',
            'Use this for medical emergencies.',
          ),
        ],
      },
    ],
  },
  {
    id: 'formal-meeting',
    scenarioNumber: 9,
    title: 'Formal Meeting',
    location: 'Embassy archive',
    difficulty: 'Advanced Plus',
    storyGoal: 'Patrick negotiates with officials guarding records about the Bangkok rift.',
    lessonGoal: 'Use formal requests, explain purpose, ask permission, and show respect.',
    equipmentReward: {
      id: 'polite-seal',
      slot: 'Relic',
      name: 'Polite Seal',
      effect: 'Raises the pass threshold rewards for formal Thai phrases.',
    },
    superMove: {
      id: 'respectful-audience',
      name: 'Respectful Audience',
      chargeRule: 'Pass request and purpose chunks without dropping Courage.',
      effect: 'Opens locked dialogue branches with formal NPCs.',
    },
    chunks: [
      {
        id: 'formal-request',
        title: 'Formal Request',
        focus: 'Polite asks',
        objective: 'Ask permission in a more formal setting.',
        phrases: [
          phrase(
            'may-ask',
            'ขอสอบถามหน่อยครับ',
            'kho sop thaam noi khrap',
            'May I ask something?',
            'Use this before a formal question.',
          ),
          phrase(
            'may-enter',
            'ขอเข้าไปได้ไหมครับ',
            'kho khao pai dai mai khrap',
            'May I enter?',
            'Use this at a controlled doorway.',
          ),
          phrase(
            'may-see-document',
            'ขอดูเอกสารได้ไหมครับ',
            'kho doo ek ga saan dai mai khrap',
            'May I see the document?',
            'Use this at the archive.',
          ),
        ],
      },
      {
        id: 'purpose',
        title: 'Purpose',
        focus: 'Explain why',
        objective: 'State your reason clearly.',
        phrases: [
          phrase(
            'looking-for-info',
            'ผมกำลังหาข้อมูลครับ',
            'phom gam lang haa kho moon khrap',
            'I am looking for information',
            'Use this to explain research.',
          ),
          phrase(
            'about-bangkok',
            'เกี่ยวกับกรุงเทพครับ',
            'giao gap grung thep khrap',
            'It is about Bangkok',
            'Use this to narrow the topic.',
          ),
          phrase(
            'important-matter',
            'เรื่องนี้สำคัญครับ',
            'rueang nee sam khan khrap',
            'This matter is important',
            'Use this to show urgency.',
          ),
        ],
      },
      {
        id: 'respectful-close',
        title: 'Respectful Close',
        focus: 'Close well',
        objective: 'Thank officials and ask next steps.',
        phrases: [
          phrase(
            'thank-for-time',
            'ขอบคุณที่สละเวลาครับ',
            'khop khun tee sa la wela khrap',
            'Thank you for your time',
            'Use this after help.',
          ),
          phrase(
            'next-step',
            'ขั้นตอนต่อไปคืออะไรครับ',
            'khan ton tor pai kheu arai khrap',
            'What is the next step?',
            'Use this after a formal answer.',
          ),
          phrase(
            'understand-formal',
            'รับทราบครับ',
            'rap saap khrap',
            'Understood',
            'Use this in formal contexts.',
          ),
        ],
      },
    ],
  },
  {
    id: 'rift-negotiation',
    scenarioNumber: 10,
    title: 'Rift Negotiation Finale',
    location: 'Temple gate under the rift',
    difficulty: 'Final',
    storyGoal: 'Patrick combines every lesson to negotiate, apologize, ask for help, and protect Su.',
    lessonGoal: 'Run full conversation chains with clarification, emotion, urgency, and polite closure.',
    equipmentReward: {
      id: 'language-crown',
      slot: 'Relic',
      name: 'Language Crown',
      effect: 'Final relic. Converts complete conversations into major story progress.',
    },
    superMove: {
      id: 'conversation-limit-break',
      name: 'Conversation Limit Break',
      chargeRule: 'Pass one phrase from each previous scenario.',
      effect: 'Launches a full Thai conversation sequence without interruption.',
    },
    chunks: [
      {
        id: 'negotiate',
        title: 'Negotiate',
        focus: 'Conflict control',
        objective: 'Calm the guardian and ask for a peaceful solution.',
        phrases: [
          phrase(
            'please-calm',
            'ใจเย็นก่อนครับ',
            'jai yen gon khrap',
            'Please calm down first',
            'Use this to de-escalate.',
          ),
          phrase(
            'can-talk',
            'คุยกันก่อนได้ไหมครับ',
            'khui gan gon dai mai khrap',
            'Can we talk first?',
            'Use this before conflict.',
          ),
          phrase(
            'want-peace',
            'ผมอยากแก้ปัญหาอย่างสงบครับ',
            'phom yaak gae pan haa yaang sa ngop khrap',
            'I want to solve this peacefully',
            'Use this in the final negotiation.',
          ),
        ],
      },
      {
        id: 'protect-su',
        title: 'Protect Su',
        focus: 'Care and urgency',
        objective: 'Explain Su needs help and ask for protection.',
        phrases: [
          phrase(
            'she-needs-help',
            'เธอต้องการความช่วยเหลือครับ',
            'ther tong gaan khwaam chuai luea khrap',
            'She needs help',
            'Use this when Su is in danger.',
          ),
          phrase(
            'protect-her',
            'ช่วยปกป้องเธอด้วยครับ',
            'chuai pok pong ther duai khrap',
            'Please protect her',
            'Use this to ask allies for help.',
          ),
          phrase(
            'trust-me',
            'เชื่อผมเถอะครับ',
            'chuea phom thoe khrap',
            'Please trust me',
            'Use this when time is short.',
          ),
        ],
      },
      {
        id: 'close-the-rift',
        title: 'Close the Rift',
        focus: 'Full conversation',
        objective: 'Combine greeting, apology, request, gratitude, and farewell.',
        phrases: [
          phrase(
            'sorry-for-trouble',
            'ขอโทษที่ทำให้ลำบากครับ',
            'kho thot tee tham hai lam baak khrap',
            'Sorry for causing trouble',
            'Use this to repair the conflict.',
          ),
          phrase(
            'please-open-gate',
            'ช่วยเปิดประตูให้หน่อยครับ',
            'chuai poet pra too hai noi khrap',
            'Please open the gate for me',
            'Use this for the final gate.',
          ),
          phrase(
            'will-not-forget',
            'ผมจะไม่ลืมครับ',
            'phom ja mai luem khrap',
            'I will not forget',
            'Use this as a sincere ending.',
          ),
        ],
      },
    ],
  },
];

export const starterScenario = lessonScenarios[0];

function phrase(
  id: string,
  targetPhrase: string,
  romanization: string,
  translation: string,
  context: string,
): ThaiPhrase {
  return {
    id,
    lesson: translation,
    targetPhrase,
    romanization,
    phoneticSpelling: romanization,
    translation,
    context,
    example: context,
  };
}
