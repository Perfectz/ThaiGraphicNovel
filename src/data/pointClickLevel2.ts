import bathroomBackgroundUrl from '../assets/adventure/level-02/bathroom-background.png';
import bellhopIdleUrl from '../assets/adventure/level-02/bellhop-idle.png';
import bellhopPointingUrl from '../assets/adventure/level-02/bellhop-pointing.png';
import frontDeskBackgroundUrl from '../assets/adventure/level-02/front-desk-background.png';
import frontDeskClerkUrl from '../assets/adventure/level-02/front-desk-clerk-neutral.png';
import keycardUrl from '../assets/adventure/level-02/keycard.png';
import lobbyBackgroundUrl from '../assets/adventure/level-02/lobby-background.png';
import passportUrl from '../assets/adventure/level-02/passport.png';
import phoneUrl from '../assets/adventure/level-02/phone.png';
import reservationPaperUrl from '../assets/adventure/level-02/reservation-paper.png';
import walletUrl from '../assets/adventure/level-02/wallet.png';

export type PointClickRoomId = 'lobby' | 'frontDesk' | 'bathroom';
export type AdventureVerb = 'look' | 'take' | 'use' | 'talk';
export type InventoryItemId = 'wallet' | 'passport' | 'phone' | 'reservationPaper' | 'keycard';
export type HotspotKind = 'item' | 'person' | 'prop';
export type AdventureConversationId = 'frontDeskCheckIn';

export type AdventureConversationTurn = {
  id: string;
  npcSpeaker: string;
  npcLineThai: string;
  npcRomanization: string;
  npcEnglish: string;
  response: {
    targetPhrase: string;
    romanization: string;
    phoneticSpelling: string;
    translation: string;
  };
  successText: string;
};

export type AdventureCommand = {
  verb: AdventureVerb;
  label: string;
  targetPhrase: string;
  romanization: string;
  phoneticSpelling: string;
  translation: string;
  successText: string;
  blockedText?: string;
  conversationBlockedText?: string;
  givesItem?: InventoryItemId;
  requiresItems?: InventoryItemId[];
  requiresConversation?: AdventureConversationId;
  conversationId?: AdventureConversationId;
  conversation?: AdventureConversationTurn[];
  conversationCompleteText?: string;
  completesAdventure?: boolean;
};

export type AdventureHotspot = {
  id: string;
  label: string;
  kind: HotspotKind;
  roomId: PointClickRoomId;
  x: number;
  y: number;
  width: number;
  anchor?: 'center' | 'bottom';
  sprite?: string;
  spriteAlt?: string;
  spriteClassName?: string;
  commands: Partial<Record<AdventureVerb, AdventureCommand>>;
};

export type AdventureRoom = {
  id: PointClickRoomId;
  title: string;
  shortTitle: string;
  background: string;
  description: string;
  hotspots: AdventureHotspot[];
};

export type AdventureInventoryItem = {
  id: InventoryItemId;
  label: string;
  thaiNoun: string;
  romanization: string;
  sprite: string;
};

export const adventureVerbs: Array<{ id: AdventureVerb; label: string }> = [
  { id: 'look', label: 'Look' },
  { id: 'take', label: 'Take' },
  { id: 'use', label: 'Use' },
  { id: 'talk', label: 'Talk' },
];

export const levelTwoInventoryItems: Record<InventoryItemId, AdventureInventoryItem> = {
  wallet: {
    id: 'wallet',
    label: 'Wallet',
    thaiNoun: 'กระเป๋าสตางค์',
    romanization: 'gra-pao sa-taang',
    sprite: walletUrl,
  },
  passport: {
    id: 'passport',
    label: 'Passport',
    thaiNoun: 'หนังสือเดินทาง',
    romanization: 'nang-sue doen-thaang',
    sprite: passportUrl,
  },
  phone: {
    id: 'phone',
    label: 'Phone',
    thaiNoun: 'โทรศัพท์',
    romanization: 'tho-ra-sap',
    sprite: phoneUrl,
  },
  reservationPaper: {
    id: 'reservationPaper',
    label: 'Reservation Paper',
    thaiNoun: 'ใบจองห้องพัก',
    romanization: 'bai jong hong phak',
    sprite: reservationPaperUrl,
  },
  keycard: {
    id: 'keycard',
    label: 'Keycard',
    thaiNoun: 'บัตรห้องพัก',
    romanization: 'bat hong phak',
    sprite: keycardUrl,
  },
};

const verbThai: Record<AdventureVerb, { prefix: string; romanization: string; phonetic: string; translation: string }> = {
  look: {
    prefix: 'ผมดู',
    romanization: 'phom duu',
    phonetic: 'pom doo',
    translation: 'I look at',
  },
  take: {
    prefix: 'ผมหยิบ',
    romanization: 'phom yip',
    phonetic: 'pom yip',
    translation: 'I take',
  },
  use: {
    prefix: 'ผมใช้',
    romanization: 'phom chai',
    phonetic: 'pom chai',
    translation: 'I use',
  },
  talk: {
    prefix: 'ผมคุยกับ',
    romanization: 'phom khui gap',
    phonetic: 'pom koo-ee gap',
    translation: 'I talk to',
  },
};

function itemCommand(
  verb: Exclude<AdventureVerb, 'talk'>,
  itemId: InventoryItemId,
  successText: string,
  options: Partial<Pick<AdventureCommand, 'givesItem' | 'requiresItems' | 'requiresConversation' | 'blockedText' | 'conversationBlockedText'>> = {},
): AdventureCommand {
  const item = levelTwoInventoryItems[itemId];
  const verbData = verbThai[verb];
  return {
    verb,
    label: verbData.translation,
    targetPhrase: `${verbData.prefix}${item.thaiNoun}ครับ`,
    romanization: `${verbData.romanization} ${item.romanization} khrap`,
    phoneticSpelling: `${verbData.phonetic} ${item.romanization} khrap`,
    translation: `${verbData.translation} the ${item.label.toLowerCase()}.`,
    successText,
    ...options,
  };
}

function talkCommand(
  label: string,
  thaiTarget: string,
  romanizationTarget: string,
  phoneticTarget: string,
  successText: string,
  options: Partial<
    Pick<
      AdventureCommand,
      'requiresItems' | 'blockedText' | 'completesAdventure' | 'conversationId' | 'conversation' | 'conversationCompleteText'
    >
  > = {},
): AdventureCommand {
  return {
    verb: 'talk',
    label: 'I talk to',
    targetPhrase: `ผมคุยกับ${thaiTarget}ครับ`,
    romanization: `phom khui gap ${romanizationTarget} khrap`,
    phoneticSpelling: `pom koo-ee gap ${phoneticTarget} khrap`,
    translation: `I talk to the ${label}.`,
    successText,
    ...options,
  };
}

const walletCommands: Partial<Record<AdventureVerb, AdventureCommand>> = {
  look: itemCommand('look', 'wallet', 'You check the wallet. Patrick will need it for check-in.'),
  take: itemCommand('take', 'wallet', 'Wallet collected. The clerk can now confirm payment details.', {
    givesItem: 'wallet',
  }),
  use: itemCommand('use', 'wallet', 'You hold up the wallet. It will matter at the front desk.'),
};

const passportCommands: Partial<Record<AdventureVerb, AdventureCommand>> = {
  look: itemCommand('look', 'passport', 'You inspect the passport. It is the main check-in document.'),
  take: itemCommand('take', 'passport', 'Passport collected. The front desk will need this.', {
    givesItem: 'passport',
  }),
  use: itemCommand('use', 'passport', 'You practice showing the passport before walking to reception.'),
};

const phoneCommands: Partial<Record<AdventureVerb, AdventureCommand>> = {
  look: itemCommand('look', 'phone', 'You find the phone near the sink with the reservation email open.'),
  take: itemCommand('take', 'phone', 'Phone collected. The booking confirmation is ready.', {
    givesItem: 'phone',
  }),
  use: itemCommand('use', 'phone', 'You check the booking email on the phone.'),
};

const reservationPaperCommands: Partial<Record<AdventureVerb, AdventureCommand>> = {
  look: itemCommand('look', 'reservationPaper', 'The reservation paper shows the hotel name and dates.'),
  take: itemCommand('take', 'reservationPaper', 'Reservation paper collected. The clerk can prepare the keycard.', {
    givesItem: 'reservationPaper',
    requiresItems: ['wallet', 'passport', 'phone'],
    requiresConversation: 'frontDeskCheckIn',
    blockedText: 'Collect the wallet, passport, and phone before taking the reservation paper.',
    conversationBlockedText: 'Complete the check-in conversation with the hostess before taking the reservation paper.',
  }),
  use: itemCommand('use', 'reservationPaper', 'You place the reservation paper on the counter for the clerk.'),
};

const keycardCommands: Partial<Record<AdventureVerb, AdventureCommand>> = {
  look: itemCommand('look', 'keycard', 'The keycard is ready in the tray, but the clerk needs the paperwork first.'),
  take: itemCommand('take', 'keycard', 'Keycard collected. You are checked in now.', {
    givesItem: 'keycard',
    requiresItems: ['wallet', 'passport', 'phone', 'reservationPaper'],
    requiresConversation: 'frontDeskCheckIn',
    blockedText: 'Collect the wallet, passport, phone, and reservation paper before taking the keycard.',
    conversationBlockedText: 'Complete the check-in conversation with the hostess before taking the keycard.',
  }),
  use: itemCommand('use', 'keycard', 'You test the keycard reader. The room is ready after you talk to the bellhop.', {
    requiresItems: ['keycard'],
    blockedText: 'Take the keycard first.',
  }),
};

export const frontDeskCheckInConversation: AdventureConversationTurn[] = [
  {
    id: 'hello',
    npcSpeaker: 'Hostess',
    npcLineThai: 'สวัสดีค่ะ',
    npcRomanization: 'sawatdee kha',
    npcEnglish: 'Hello.',
    response: {
      targetPhrase: 'สวัสดีครับ ผมอยากเช็คอินครับ',
      romanization: 'sawatdee khrap phom yaak check-in khrap',
      phoneticSpelling: 'sah-waht-dee khrap pom yahk chek-in khrap',
      translation: 'Hello, I would like to check in.',
    },
    successText: 'The hostess understands that you want to check in.',
  },
  {
    id: 'name',
    npcSpeaker: 'Hostess',
    npcLineThai: 'คุณชื่ออะไรคะ',
    npcRomanization: 'khun chue arai kha',
    npcEnglish: 'What is your name?',
    response: {
      targetPhrase: 'ผมชื่อแพทริกครับ',
      romanization: 'phom chue Patrick khrap',
      phoneticSpelling: 'pom cheu Patrick khrap',
      translation: 'My name is Patrick.',
    },
    successText: 'The hostess writes Patrick on the check-in form.',
  },
  {
    id: 'documents',
    npcSpeaker: 'Hostess',
    npcLineThai: 'คุณมีหนังสือเดินทางและกระเป๋าสตางค์ไหมคะ',
    npcRomanization: 'khun mee nang-sue doen-thaang lae gra-pao sa-taang mai kha',
    npcEnglish: 'Do you have your passport and wallet?',
    response: {
      targetPhrase: 'มีครับ',
      romanization: 'mee khrap',
      phoneticSpelling: 'mee khrap',
      translation: 'Yes, I have them.',
    },
    successText: 'The hostess checks the passport and wallet.',
  },
  {
    id: 'guest',
    npcSpeaker: 'Hostess',
    npcLineThai: 'คุณมีแขกมาด้วยไหมคะ',
    npcRomanization: 'khun mee khaek maa duai mai kha',
    npcEnglish: 'Do you have a guest with you?',
    response: {
      targetPhrase: 'ไม่มีครับ',
      romanization: 'mai mee khrap',
      phoneticSpelling: 'mai mee khrap',
      translation: 'No, I do not.',
    },
    successText: 'The hostess marks the room for one guest.',
  },
  {
    id: 'thanks',
    npcSpeaker: 'Hostess',
    npcLineThai: 'ยินดีต้อนรับค่ะ คุณเช็คอินแล้วค่ะ กรุณาหยิบใบจองห้องพักและบัตรห้องพักค่ะ',
    npcRomanization: 'yin dee ton rap kha khun check-in laeo kha ga-ru-na yip bai jong hong phak lae bat hong phak kha',
    npcEnglish: 'Welcome to the hotel. You are checked in. Please take your reservation paper and keycard.',
    response: {
      targetPhrase: 'ขอบคุณที่ช่วยครับ',
      romanization: 'khop khun tee chuai khrap',
      phoneticSpelling: 'khop khun tee chuai khrap',
      translation: 'Thank you for the help.',
    },
    successText: 'The hostess smiles and points to the reservation paper and keycard.',
  },
];

const clerkCommands: Partial<Record<AdventureVerb, AdventureCommand>> = {
  look: {
    ...talkCommand(
      'hostess',
      'พนักงานต้อนรับ',
      'pha-nak-ngaan ton-rap',
      'pa-nak-ngaan ton-rap',
      'The front desk hostess waits politely behind the counter.',
    ),
    verb: 'look',
    label: 'I look at',
    targetPhrase: 'ผมดูพนักงานต้อนรับครับ',
    romanization: 'phom duu pha-nak-ngaan ton-rap khrap',
    phoneticSpelling: 'pom doo pa-nak-ngaan ton-rap khrap',
    translation: 'I look at the front desk hostess.',
  },
  talk: talkCommand(
    'hostess',
    'พนักงานต้อนรับ',
    'pha-nak-ngaan ton-rap',
    'pa-nak-ngaan ton-rap',
    'The hostess starts the hotel check-in conversation.',
    {
      conversationId: 'frontDeskCheckIn',
      conversation: frontDeskCheckInConversation,
      conversationCompleteText: 'Check-in conversation complete. Take the reservation paper and keycard from the desk.',
    },
  ),
};

const bellhopCommands: Partial<Record<AdventureVerb, AdventureCommand>> = {
  look: {
    ...talkCommand(
      'bellhop',
      'พนักงานยกกระเป๋า',
      'pha-nak-ngaan yok gra-pao',
      'pa-nak-ngaan yok gra-pao',
      'The bellhop is ready to carry the luggage once check-in is complete.',
    ),
    verb: 'look',
    label: 'I look at',
    targetPhrase: 'ผมดูพนักงานยกกระเป๋าครับ',
    romanization: 'phom duu pha-nak-ngaan yok gra-pao khrap',
    phoneticSpelling: 'pom doo pa-nak-ngaan yok gra-pao khrap',
    translation: 'I look at the bellhop.',
  },
  talk: talkCommand(
    'bellhop',
    'พนักงานยกกระเป๋า',
    'pha-nak-ngaan yok gra-pao',
    'pa-nak-ngaan yok gra-pao',
    'The bellhop takes the luggage and leads Patrick toward the room.',
    {
      requiresItems: ['wallet', 'passport', 'phone', 'reservationPaper', 'keycard'],
      blockedText: 'Collect all five check-in items before asking the bellhop to take you to the room.',
      completesAdventure: true,
    },
  ),
};

export const levelTwoRooms: AdventureRoom[] = [
  {
    id: 'lobby',
    title: 'Lobby',
    shortTitle: 'Lobby',
    background: lobbyBackgroundUrl,
    description: 'A warm Bangkok hotel lobby. Find the personal items before approaching the desk.',
    hotspots: [
      {
        id: 'wallet',
        label: 'Wallet',
        kind: 'item',
        roomId: 'lobby',
        x: 31,
        y: 69,
        width: 7,
        sprite: walletUrl,
        spriteAlt: 'Wallet',
        commands: walletCommands,
      },
      {
        id: 'passport',
        label: 'Passport',
        kind: 'item',
        roomId: 'lobby',
        x: 43,
        y: 65,
        width: 7,
        sprite: passportUrl,
        spriteAlt: 'Passport',
        commands: passportCommands,
      },
      {
        id: 'bellhop',
        label: 'Bellhop',
        kind: 'person',
        roomId: 'lobby',
        x: 75,
        y: 84,
        width: 10.5,
        anchor: 'bottom',
        sprite: bellhopIdleUrl,
        spriteAlt: 'Bellhop',
        commands: bellhopCommands,
      },
    ],
  },
  {
    id: 'frontDesk',
    title: 'Front Desk',
    shortTitle: 'Desk',
    background: frontDeskBackgroundUrl,
    description: 'The reception counter has the clerk, reservation paper, and keycard tray.',
    hotspots: [
      {
        id: 'clerk',
        label: 'Front Desk Hostess',
        kind: 'person',
        roomId: 'frontDesk',
        x: 58,
        y: 72,
        width: 11.5,
        anchor: 'bottom',
        sprite: frontDeskClerkUrl,
        spriteAlt: 'Front desk hostess',
        commands: clerkCommands,
      },
      {
        id: 'reservationPaper',
        label: 'Reservation Paper',
        kind: 'item',
        roomId: 'frontDesk',
        x: 41,
        y: 71,
        width: 8,
        sprite: reservationPaperUrl,
        spriteAlt: 'Reservation paper',
        commands: reservationPaperCommands,
      },
      {
        id: 'keycard',
        label: 'Keycard',
        kind: 'item',
        roomId: 'frontDesk',
        x: 66,
        y: 71,
        width: 6,
        sprite: keycardUrl,
        spriteAlt: 'Hotel keycard',
        commands: keycardCommands,
      },
    ],
  },
  {
    id: 'bathroom',
    title: 'Bathroom',
    shortTitle: 'Bath',
    background: bathroomBackgroundUrl,
    description: 'A clean hotel bathroom. Check the sink counter for the booking phone.',
    hotspots: [
      {
        id: 'phone',
        label: 'Phone',
        kind: 'item',
        roomId: 'bathroom',
        x: 45,
        y: 67,
        width: 8,
        sprite: phoneUrl,
        spriteAlt: 'Smartphone',
        commands: phoneCommands,
      },
      {
        id: 'bellhopMirror',
        label: 'Bellhop Call Button',
        kind: 'prop',
        roomId: 'bathroom',
        x: 79,
        y: 45,
        width: 9,
        sprite: bellhopPointingUrl,
        spriteAlt: 'Bellhop call icon',
        spriteClassName: 'opacity-0',
        commands: {
          use: {
            verb: 'use',
            label: 'I use',
            targetPhrase: 'ผมใช้ปุ่มเรียกพนักงานครับ',
            romanization: 'phom chai pum riak pha-nak-ngaan khrap',
            phoneticSpelling: 'pom chai poom riak pa-nak-ngaan khrap',
            translation: 'I use the staff call button.',
            successText: 'The lobby bell chimes softly. The bellhop is still waiting in the lobby.',
          },
        },
      },
    ],
  },
];

export function getPointClickRoom(roomId: PointClickRoomId): AdventureRoom {
  return levelTwoRooms.find((room) => room.id === roomId) ?? levelTwoRooms[0];
}

export function getInventoryItem(itemId: InventoryItemId): AdventureInventoryItem {
  return levelTwoInventoryItems[itemId];
}

export function getMissingInventoryItems(
  inventory: InventoryItemId[],
  requiredItems: InventoryItemId[] = [],
): InventoryItemId[] {
  return requiredItems.filter((itemId) => !inventory.includes(itemId));
}
