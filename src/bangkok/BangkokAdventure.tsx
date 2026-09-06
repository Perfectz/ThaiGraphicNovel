import ReunionPanel from './ReunionPanel';
import {storyEncounters} from './storyEncounters';
import { advanceReunion, reunionReason, reunionStatus, reunionStep, type ReunionStep } from './reunion';
import { cityAreas, cityAreaAt, cityWalkways, inside, canalWalk, type CityArea } from './city';
import { useEffect, useRef, useState } from 'react';
import { BangkokWorld } from './BangkokWorld';
import FerryCrossing from './FerryCrossing';
import CharacterVoice from './CharacterVoice';
import {
  beginEscort,
  finishEscort,
  escortStatus,
  escortInvitation,
  escortArrival,
  type EscortSave,
} from './stationEscort';
import {
  actors,
  moveAdventure,
  transitTo,
  updateBattle,
  leaveBattle,
  canBattle,
  completeConversation,
  toggleTalent,
  completeJourneyStep,
  flag,
  has,
  objective,
  openChest,
  readAdventure,
  startBattle,
  startPracticeBattle,
  writeAdventure,
  type ActorId,
  type Battle,
} from './adventure';
import { conversations, type StoryLine } from './adventureStory';
import {
  canalFlags,
  canalHost,
  canalLines,
  canalStatus,
  canalStepFor,
  advanceCanalErrand,
  canalApproach,
  type CanalStep,
} from './canalErrand';
import { phrases, choicesFor, days } from './curriculum';
import { addPracticeTime, localDate, persistTraining, readTraining, recordAttempt } from './learning';
import { PracticeScope } from './PracticeTiming';
import TodayPractice from './TodayPractice';
import { useTrainingVoice } from './useTrainingVoice';
import SpeakChoice from './SpeakChoice';
import ExpeditionBattle from './ExpeditionBattle';
import JourneyVisit from './JourneyVisit';
import PartyGrowth from './PartyGrowthPanel';
import QuestJournal from './QuestJournalPanel';
import { trackQuest, trackedQuest, questJournal, type QuestId, type QuestDestination } from './questJournal';
import CityServicePanel from './CityServicePanel';
import EveningOutingPanel from './EveningOutingPanel';
import LanternTradePanel from './LanternTradePanel';
import {
  advanceLanternTrade,
  lanternTradeReason,
  lanternReplyReason,
  lanternName,
  leavesLanternTrade,
  type LanternOffer,
} from './lanternTrade';
import {
  advanceEvening,
  eveningHost,
  eveningReason,
  eveningRoute,
  eveningStatus,
  eveningStep,
  type EveningStep,
} from './eveningOuting';
import { servicesForHost, purchaseService, type ServiceHost, type CityServiceId } from './cityServices';
import { partyLevel, partyGrowth, talentCost } from './partyGrowth';
import { discoveries, discoveryFor, discoveryCount, hasRiverCharm } from './discoveries';
import {
  cityJourneys,
  journeyHosts,
  recordJourneyPractice,
  journeyCursor,
  beginJourney,
  markJourneyMeaningHelp,
  type JourneyResult,
} from './cityJourneys';
import { useGameMusic } from '../hooks/useGameMusic';
import { useSoundSettings } from '../hooks/useSoundSettings';
import { saveSoundSettings } from '../services/soundSettings';
import { Modal } from '../components/ui/Modal';
import music from '../assets/audio/music/stage-01-hotel-lobby.mp3';
import battleMusic from '../assets/audio/music/stage-03-night-market.mp3';
import streetMusic from '../assets/audio/music/stage-02-front-desk.mp3';
import journeyMusic from '../assets/audio/music/title-theme.mp3';
import { adventureScore, type ScoreTheme } from './adventureScore';
import './bangkok.css';
import './adventure.css';
import './journeys.css';

type Screen = 'title' | 'world' | 'battle' | 'crossing' | 'ending';
type Dialogue = {
  actor: ActorId;
  lines: StoryLine[];
  index: number;
  reward?: ActorId | 'intro' | 'departed';
  challenge?: Battle['id'];
  canalStep?: CanalStep;
  escortStep?: 'begin' | 'finish';
};
export default function BangkokAdventure({ onTrain }: { onTrain: () => void }) {
  const [save, setSave] = useState(readAdventure);
  const [screen, setScreen] = useState<Screen>('title');
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [near, setNear] = useState<ActorId | null>(null);
  const [bag, setBag] = useState(false);
  const [growthMenu, setGrowthMenu] = useState(false);
  const [serviceHost, setServiceHost] = useState<ServiceHost | null>(null);
  const [eveningOpen, setEveningOpen] = useState(false);
  const [lanternOpen, setLanternOpen] = useState(false);
  const [reunionHost, setReunionHost] = useState<ActorId | null>(null);
  const [journal, setJournal] = useState(false);
  const [map, setMap] = useState(false);
  const [journeyBoard, setJourneyBoard] = useState(false);
  const [journeyVisit, setJourneyVisit] = useState(false);
  const [mapArea, setMapArea] = useState<CityArea>('hotel');
  const [status, setStatus] = useState('loading');
  const [saveError, setSaveError] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [answered, setAnswered] = useState(false);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<BangkokWorld | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const interactRef = useRef<(id: ActorId) => void>(() => undefined);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const dialogueRef = useRef(dialogue);
  dialogueRef.current = dialogue;
  const scenePhrase = dialogue?.lines[dialogue.index].phrase;
  const phrase = scenePhrase ? phrases[scenePhrase] : undefined;
  const voice = useTrainingVoice(phrase);
  const sound = useSoundSettings();
  const goal = objective(save);
  const followedStory = trackedQuest(save);
  const growth = partyGrowth(save.xp, save.talents);
  const freeTalents = growth.level - 1 - talentCost(growth.talents);
  const previousLevel = useRef(growth.level);
  useEffect(() => {
    const level = partyLevel(save.xp);
    if (level > previousLevel.current) {
      setNotice(
        `PARTY LEVEL ${level} · New talent points available ${save.battle ? 'after this battle' : '· Open Patrick’s level to develop the party'}.`,
      );
      world.current?.celebrate();
    }
    previousLevel.current = level;
  }, [save.xp, save.battle]);
  const activeJourney = save.journeys.active;
  const journeyDefinition =
    cityJourneys[
      (activeJourney?.id ??
        cityJourneys.find((j) => !save.journeys.completed.some((c) => c.id === j.id))?.id ??
        30) - 1
    ];
  const district = cityAreas.find((a) => a.id === cityAreaAt(save.position));
  const byCanal = inside(save.position, cityWalkways[0]);
  const nearbyCanalStep = near ? canalStepFor(save, near) : null;
  const line = dialogue?.lines[dialogue.index];
  const busy = voice.recording || voice.coachBusy || choiceBusy;
  function reportWorldMove(position: { x: number; z: number }, escort?: EscortSave) {
    setSave((s) => {
      if (
        Math.hypot(position.x - s.position.x, position.z - s.position.z) < 0.05 &&
        (!escort || escort === s.escort)
      )
        return s;
      return moveAdventure(escort ? { ...s, escort } : s, position);
    });
  }
  const scoreTheme = adventureScore(district?.id ?? null, screen);
  const lastScore = useRef<ScoreTheme>('hotel');
  if (screen === 'world' && scoreTheme) lastScore.current = scoreTheme;
  const scoreTracks = { hotel: music, street: streetMusic, market: battleMusic, journey: journeyMusic };
  useGameMusic(scoreTracks[scoreTheme ?? lastScore.current], {
    ...sound,
    musicVolume: sound.musicVolume * 0.4,
  });
  useEffect(() => {
    if (!host.current) return;
    try {
      const instance = new BangkokWorld(host.current, setStatus, () => undefined);
      world.current = instance;
      instance.setBackdrop(`${import.meta.env.BASE_URL}bangkok/river-skyline.png`);
      return () => {
        instance.dispose();
        world.current = null;
      };
    } catch {
      setStatus('error');
    }
  }, []);
  useEffect(() => {
    if (screen !== 'crossing' && screen !== 'ending') world.current?.setDeparture(null);
    world.current?.configureAdventure(
      save,
      {
        interact: (id) => interactRef.current(id),
        near: setNear,
        move: reportWorldMove,
      },
      screen !== 'world' ||
        !!dialogue ||
        bag ||
        journal ||
        map ||
        journeyBoard ||
        journeyVisit ||
        growthMenu ||
        !!serviceHost ||
        eveningOpen ||
        lanternOpen ||
        !!reunionHost,
    );
    world.current?.setState({
      district: 'hotel',
      mode: screen === 'title' ? 'home' : screen === 'battle' ? 'encounter' : 'adventure',
      trial: screen === 'battle',
      boss: save.battle?.id === 'keeper',
      reunion: !!reunionHost && ['welcome', 'finish'].includes(reunionStep(save, reunionHost) ?? ''),
      conversation:
        !!dialogue || journeyVisit || !!serviceHost || eveningOpen || lanternOpen || !!reunionHost,
      contact:
        dialogue?.actor ??
        reunionHost ??
        serviceHost ??
        (lanternOpen ? 'artisan' : undefined) ??
        (eveningOpen ? eveningHost(save) : undefined) ??
        (journeyVisit && save.journeys.active
          ? cityJourneys[save.journeys.active.id - 1].actors[save.journeys.active.stop]
          : undefined),
      progress: 0,
    });
  }, [
    save,
    screen,
    dialogue,
    bag,
    journal,
    map,
    journeyBoard,
    journeyVisit,
    growthMenu,
    serviceHost,
    eveningOpen,
    lanternOpen,
    reunionHost,
  ]);
  useEffect(() => {
    setSaveError(!writeAdventure(save));
  }, [save]);
  useEffect(() => {
    if (!journeyVisit) return;
    const leave = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setJourneyVisit(false);
    };
    window.addEventListener('keydown', leave);
    return () => window.removeEventListener('keydown', leave);
  }, [journeyVisit, busy]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 8500);
    return () => clearTimeout(timer);
  }, [notice]);
  function resetPrompt() {
    setFeedback('');
    setAnswered(false);
  }
  function talk(actor: ActorId, lines: StoryLine[], reward?: Dialogue['reward'], challenge?: Battle['id']) {
    resetPrompt();
    setDialogue({ actor, lines, index: 0, reward, challenge });
  }
  function beginSparring() {
    if (busy || saveRef.current.battle) return;
    setSave(startPracticeBattle(saveRef.current));
    setDialogue(null);
    setGrowthMenu(false);
    setNotice('');
    setScreen('battle');
    resetPrompt();
  }
  function talkCanal(actor: ActorId) {
    const step = canalStepFor(saveRef.current, actor);
    const person = actors.find((a) => a.id === actor)!;
    if (
      !step ||
      busy ||
      saveRef.current.battle ||
      Math.hypot(saveRef.current.position.x - person.x, saveRef.current.position.z - person.z) > 2.5
    )
      return;
    resetPrompt();
    setDialogue({ actor, lines: canalLines[step], index: 0, canalStep: step });
  }
  function talkEscort(finish = false) {
    const s = saveRef.current;
    if (busy || s.battle) return;
    const point = finish ? { x: -40, z: 17.5 } : s.escort.position;
    if (Math.hypot(s.position.x - point.x, s.position.z - point.z) > 2.5) return;
    if (!has(s, 'innkeeper') || (!finish && s.escort.stage !== 'waiting')) {
      talk('traveler', [
        {
          speaker: 'Nok',
          text: has(s, 'innkeeper')
            ? escortStatus(s)
            : 'Su suggests checking in with Mali at your hotel before offering to walk with Nok.',
        },
      ]);
      return;
    }
    if (finish && s.escort.stage !== 'arrived') return;
    resetPrompt();
    setDialogue({
      actor: finish ? 'station' : 'traveler',
      lines: finish ? escortArrival : escortInvitation,
      index: 0,
      escortStep: finish ? 'finish' : 'begin',
    });
  }
  function walkEscort(toStation = false) {
    setMap(false);
    requestAnimationFrame(() => {
      world.current?.configureAdventure(
        saveRef.current,
        { interact: (id) => interactRef.current(id), near: setNear, move: reportWorldMove },
        false,
      );
      world.current?.travelPoint(toStation ? { x: -39.6, z: 16.8 } : saveRef.current.escort.position);
    });
  }
  function walkQuest(id: QuestId, destination: QuestDestination) {
    const current = saveRef.current;
    if (current.battle || (current.journeys.active && !current.journeys.active.paused)) return;
    const valid = questJournal(current)
      .find((q) => q.id === id && !q.complete)
      ?.destinations.find((d) => d.actor === destination.actor);
    if (!valid) return;
    setSave((s) => trackQuest(s, id));
    setJournal(false);
    setMap(false);
    requestAnimationFrame(() => {
      world.current?.configureAdventure(
        saveRef.current,
        { interact: (actor) => interactRef.current(actor), near: setNear, move: reportWorldMove },
        false,
      );
      world.current?.travelPoint(valid.point);
    });
  }
  function walkCanalErrand(actor: ActorId) {
    setMap(false);
    requestAnimationFrame(() => {
      world.current?.configureAdventure(
        saveRef.current,
        {
          interact: (id) => interactRef.current(id),
          near: setNear,
          move: reportWorldMove,
        },
        false,
      );
      world.current?.travelPoint(canalApproach(actor));
    });
  }
  function beginFight(id: Battle['id']) {
    const site=actors.find(a=>a.id===(id==='sentinel'?'waystone':storyEncounters[id].actor))!;
    if(Math.hypot(saveRef.current.position.x-site.x,saveRef.current.position.z-site.z)>2.5)return;
    const next = startBattle(saveRef.current, id);
    if (!next.battle) return;
    saveRef.current=next;
    setSave(next);
    setScreen('battle');
    resetPrompt();
    setNotice(
      id === 'sentinel'
        ? 'OPTIONAL CHALLENGE · THE WAYWARDEN'
        : id === 'keeper'
          ? 'BOSS · THE KEEPER OF UNSAID WORDS'
          : 'ENCOUNTER · A MURMUR IN THE MIST',
    );
  }
  function findWaystone() {
    setMap(false);
    requestAnimationFrame(() => {
      world.current?.configureAdventure(
        saveRef.current,
        {
          interact: (id) => interactRef.current(id),
          near: setNear,
          move: reportWorldMove,
        },
        false,
      );
      world.current?.travelTo('waystone');
    });
  }
  interactRef.current = (id) => {
    if (
      screenRef.current !== 'world' ||
      dialogueRef.current ||
      serviceHost ||
      eveningOpen ||
      lanternOpen ||
      !!reunionHost
    )
      return;
    const s = saveRef.current;
    if (s.trackedQuest === 'reunion' && !reunionReason(s, id)) {
      setReunionHost(id);
      return;
    }
    if (s.trackedQuest === 'travel-lantern' && id === 'artisan' && !lanternTradeReason(s)) {
      setLanternOpen(true);
      return;
    }
    if (s.trackedQuest === 'evening' && id === eveningHost(s) && !eveningReason(s)) {
      setEveningOpen(true);
      return;
    }
    if (id === 'traveler') {
      talkEscort();
      return;
    }
    if (id === 'canal-lantern') {
      if (canalStepFor(s, id)) talkCanal(id);
      else
        talk(id, [
          {
            speaker: 'Su',
            text: has(s, 'innkeeper')
              ? canalStatus(s)
              : 'A damaged lantern waits beside the canal. Let us check in with Mali at the hotel first, then come back to see whether we can help.',
          },
        ]);
      return;
    }
    if (id === 'waystone') {
      if (has(s, 'sentinel'))
        talk(id, [
          {
            speaker: 'Su',
            text: 'The arrows point steadily now. Your Wayfinder Seal starts every future battle with 20 resonance. The main road is yours again.',
          },
        ]);
      else if (!has(s, 'station') || !has(s, 'innkeeper'))
        talk(id, [
          {
            speaker: 'Su',
            text: 'The arrows on this waystone keep turning. A guardian of lost travelers is caught inside. Check in at the hotel, then ask Dao by the Sukhumvit train about finding your way. We can return when we are ready.',
          },
        ]);
      else
        talk(
          id,
          [
            {
              speaker: 'Su',
              text: 'Every arrow points somewhere different. Instead of guessing, ask where you want to go. Say that you are looking for the station.',
              phrase: 'where-is-station',
              response: 'The arrows settle. A brass compass opens and the Waywarden answers your call.',
            },
            {
              speaker: 'Su',
              text: 'An optional challenge: compass armor halves word damage until exposed. Use Su’s Echo Lens, then Patrick’s Clear Intent. Counters and our duet bypass the armor. Heavy attacks come every second round; break or weaken it first. Win the Wayfinder Seal to start future battles with 20 resonance. We can leave and prepare first.',
            },
          ],
          undefined,
          'sentinel',
        );
      return;
    }
    const discovery = discoveryFor(id);
    if (discovery) {
      talk(
        id,
        has(s, id)
          ? [
              { speaker: 'Su', text: discovery.story },
              {
                speaker: 'Su',
                text: 'This memory is safe in your explorer’s journal. There are more small stories along the side paths.',
              },
            ]
          : [
              {
                speaker: 'Su',
                text: discovery.story,
                phrase: discovery.phrase,
                response: discovery.response,
              },
              {
                speaker: 'Su',
                text: `A new page for our explorer’s journal. You found ${discoveryCount(s.flags) + 1} of 6 city memories. ${discoveryCount(s.flags) === 5 ? 'Together, these memories form a River Charm. After a story battle victory, it restores 15 HP.' : 'Find all six to earn the River Charm: it restores 15 HP after each story battle victory.'}`,
              },
            ],
        has(s, id) ? undefined : id,
      );
      return;
    }
    const outing = s.journeys.active;
    if (outing && !outing.paused && cityJourneys[outing.id - 1].actors[outing.stop] === id) {
      setJourneyVisit(true);
      return;
    }
    if (id === 'su') {
      talk(
        id,
        has(s, 'intro')
          ? [
              {
                speaker: 'Su',
                text: `${objective(s).text} Look around, open your map, or talk to people again. If you want to rehearse a phrase, we can train at camp.`,
              },
            ]
          : conversations.su!,
        has(s, 'intro') ? undefined : 'intro',
      );
      return;
    }
    if (has(s, id) && servicesForHost(id).length) {
      resetPrompt();
      setServiceHost(id as ServiceHost);
      return;
    }
    if (id === 'ferry' && has(s, 'keeper')) {
      talk(
        id,
        [
          {
            speaker: 'Niran',
            text: 'There it is—the river is shining again! Come aboard, Patrick. You and Su have earned a place on the last ferry.',
          },
          {
            speaker: 'Su',
            text: 'A room, a meal, a favour, a passage across the river. You did all that with a handful of words. Imagine what you will do with a month of them.',
          },
          {
            speaker: 'Su',
            text: 'Think of the people who helped us today. This is a goodbye with a promise to return. Practise telling them you will see them again.',
            phrase: 'see-you',
            response: 'You try the farewell. Niran holds the boat steady while you and Su step aboard.',
          },
        ],
        'departed',
      );
      return;
    }
    if (id === 'ferry' && !has(s, 'cook')) {
      talk(id, [
        {
          speaker: 'Niran',
          text: 'The lantern is out, the river is full of mist, and I have not eaten since morning. Could you ask Uncle Lek in Yaowarat about my supper?',
        },
      ]);
      return;
    }
    if (id === 'ferry' && has(s, 'ferry')) {
      talk(id, [
        {
          speaker: 'Niran',
          text: 'Your seats are waiting. Find the spark in Lumphini Park, then take it to the Old Town lantern court. Every district has a story worth hearing.',
        },
      ]);
      return;
    }
    if (id === 'chest') {
      const next = openChest(s);
      setSave(openChest);
      if (next !== s) world.current?.celebrate();
      talk(id, [
        {
          speaker: 'Su',
          text: has(s, 'chest')
            ? 'The old chest is empty. Your Jade Ward is already equipped: it reduces every spirit hit by 3 HP.'
            : has(s, 'innkeeper')
              ? 'The brass key turns! Inside: a Jade Ward, 25 coins, and a flask of Thai tea. The ward reduces incoming damage by 3. A little exploring pays off.'
              : 'Locked. A brass key might fit. Let us ask someone at the inn.',
        },
      ]);
      return;
    }
    if (id === 'wisp' || id === 'shrine') {
      const battleId = id === 'wisp' ? 'murmur' : 'keeper';
      if (canBattle(s, battleId)) talk(id,storyEncounters[battleId].lines,undefined,battleId);
      else
        talk(id, [
          {
            speaker: 'Su',
            text: has(s, battleId)
              ? 'The light here is steady now. We made a difference.'
              : id === 'wisp'
                ? 'That spirit feeds on uncertainty. Let us learn a greeting at the inn before we face it.'
                : 'We need a lantern spark, and Niran needs his supper before he can show us the ritual. Check the journal for our next step.',
          },
        ]);
      return;
    }
    if (conversations[id]) talk(id, conversations[id]!, id);
  };
  function startJourney(replayId?: number) {
    if (!has(saveRef.current, 'innkeeper')) return;
    const s = saveRef.current,
      next = { ...s, journeys: beginJourney(s.journeys, readTraining(), localDate(), replayId) };
    saveRef.current = next;
    setSave(next);
    setJourneyBoard(false);
    setNotice('TRAVEL MISSION · Follow the highlighted person on your map.');
  }
  function finishJourneyStep(cursor: string, result: JourneyResult) {
    const s = saveRef.current,
      a = s.journeys.active;
    if (!a) return;
    const next = completeJourneyStep(s, cursor, result);
    if (next === s) return;
    const journeys = next.journeys;
    const reward = journeys.completed.length > s.journeys.completed.length;
    saveRef.current = next;
    setSave(next);
    persistTraining(recordJourneyPractice(readTraining(), a, result));
    if (!journeys.active || journeys.active.stop !== a.stop) {
      setJourneyVisit(false);
      world.current?.celebrate();
      if (!journeys.active) {
        setJourneyBoard(true);
        setNotice(
          reward
            ? 'PASSPORT STAMP · +60 XP · +20 coins · +1 rice parcel'
            : 'REHEARSAL COMPLETE · Your practice is saved.',
        );
      } else setNotice('STOP COMPLETE · Your next contact is marked on the map.');
    }
  }
  function credit(correct: boolean, spoken = false) {
    if (!phrase || !correct) return;
    persistTraining(recordAttempt(readTraining(), phrase.id, spoken ? 'spoken' : 'choice', true));
    if (screen !== 'battle')
      setSave((s) =>
        s.learned.includes(phrase.id) ? s : { ...s, learned: [...s.learned, phrase.id], xp: s.xp + 5 },
      );
  }
  function answer(id: string, spoken = false) {
    if (!phrase || busy || answered) return;
    if (id !== phrase.id) {
      setFeedback('Su: “That means something different. Listen to this phrase, then try again.”');
      return;
    }
    credit(true, spoken);
    world.current?.celebrate();
    {
      setAnswered(true);
      setFeedback(line?.response ?? 'The conversation moves forward.');
    }
  }
  function nextDialogue() {
    if (!dialogue || busy) return;
    if (line?.phrase && !answered) return;
    if (dialogue.index + 1 < dialogue.lines.length) {
      setDialogue({ ...dialogue, index: dialogue.index + 1 });
      resetPrompt();
      return;
    }
    const reward = dialogue.reward;
    if (dialogue.escortStep) {
      const next =
        dialogue.escortStep === 'begin' ? beginEscort(saveRef.current) : finishEscort(saveRef.current);
      if (next !== saveRef.current) {
        saveRef.current = next;
        setSave(next);
        setNotice(
          dialogue.escortStep === 'finish'
            ? 'A WAY BACK TOGETHER · +70 XP · +20 coins · Thai tea'
            : escortStatus(next),
        );
        if (dialogue.escortStep === 'finish') world.current?.celebrate();
      }
    }
    if (dialogue.canalStep) {
      const next = advanceCanalErrand(saveRef.current, dialogue.canalStep);
      if (next !== saveRef.current) {
        saveRef.current = next;
        setSave(next);
        setNotice(
          dialogue.canalStep === 'canal-restored'
            ? 'A LIGHT FOR LATE WALKERS · +80 XP · +25 coins · Rice and tea'
            : canalStatus(next),
        );
        world.current?.celebrate();
      }
    }
    if (reward === 'intro') setSave((s) => flag(s, 'intro'));
    else if (reward === 'departed') {
      setSave((s) => flag(s, 'departed'));
      setScreen('crossing');
    } else if (reward) {
      setSave((s) => completeConversation(s, reward));
      setNotice(
        discoveryFor(reward)
          ? `CITY MEMORY · ${discoveryFor(reward)!.name} · +25 XP · Supplies added to your bag`
          : reward === 'innkeeper'
            ? 'QUEST COMPLETE · Brass key acquired · Rest unlocked'
            : reward === 'cook'
              ? 'QUEST COMPLETE · Supper parcel + 2 rice parcels'
              : reward === 'ferry'
                ? 'QUEST COMPLETE · Ferry pass acquired'
                : reward === 'station'
                  ? 'CITY PASS · Return travel unlocked to places you have visited'
                  : reward === 'gardener'
                    ? 'PARK FAVOUR · Thai tea added to your bag'
                    : 'ARTISAN FAVOUR · 15 coins received',
      );
      world.current?.celebrate();
    }
    setDialogue(null);
    resetPrompt();
    if (dialogue.challenge) beginFight(dialogue.challenge);
  }
  function consumeItem(item: 'rice' | 'tea') {
    if (screen === 'battle') return;
    setSave((s) =>
      s[item] && s.hp < 100
        ? { ...s, [item]: s[item] - 1, hp: Math.min(100, s.hp + (item === 'rice' ? 45 : 20)) }
        : s,
    );
  }
  function servicePractice(id: string, spoken: boolean) {
    persistTraining(recordAttempt(readTraining(), id, spoken ? 'spoken' : 'choice', true));
    setSave((s) => (s.learned.includes(id) ? s : { ...s, learned: [...s.learned, id], xp: s.xp + 5 }));
  }
  function confirmLantern(offer: LanternOffer, reply: string) {
    const current = saveRef.current;
    if (current.lantern.offer !== offer || lanternReplyReason(current, reply)) return;
    if (leavesLanternTrade(reply)) {
      setLanternOpen(false);
      return;
    }
    const next = advanceLanternTrade(current, offer, reply);
    if (next === current) return;
    saveRef.current = next;
    setSave(next);
    if (next.lantern.owned) {
      setLanternOpen(false);
      world.current?.celebrate();
      setNotice(
        `${lanternName(next.lantern).toUpperCase()} · Su carries your light · City memories shine from farther away · +40 XP`,
      );
    }
  }
  function confirmReunion(actor: ActorId, step: ReunionStep, reply: string) {
    const current = saveRef.current;
    const next = advanceReunion(current, actor, step, reply);
    if (next === current) return false;
    saveRef.current = next;
    setSave(next);
    if (step !== 'welcome') {
      setReunionHost(null);
      setNotice(
        step === 'finish'
          ? 'A PROMISE KEPT · +120 XP · Two rice parcels · Two teas · Memory saved'
          : reunionStatus(next),
      );
    }
    if (step === 'finish') world.current?.celebrate();
    return true;
  }
  function confirmEvening(step: EveningStep, reply: string) {
    const current = saveRef.current;
    const next = advanceEvening(current, step, reply);
    if (next === current) return false;
    saveRef.current = next;
    setSave(next);
    if (step !== 'order') {
      setEveningOpen(false);
      setNotice(
        step === 'finish'
          ? `AN EVENING OF OUR OWN · +60 XP · ${eveningRoute(next) === 'food' ? 'Two rice parcels' : 'Two flasks of tea'} · Memory saved in your journal`
          : eveningStatus(next),
      );
    }
    if (step === 'finish') world.current?.celebrate();
    return true;
  }
  function receiveService(id: CityServiceId) {
    const current = saveRef.current,
      next = purchaseService(current, id);
    if (next === current) return false;
    saveRef.current = next;
    setSave(next);
    world.current?.celebrate();
    return true;
  }
  const choices = phrase
    ? choicesFor(
        phrase.id,
        {
          ...days[0],
          phraseIds: [...new Set([phrase.id, ...save.learned, 'hello', 'thank-you', 'not-spicy'])],
        },
        screen === 'battle' ? (save.battle?.round ?? 0) : (dialogue?.index ?? 0),
      )
    : [];
  const audioTools = phrase && (
    <div className="rpg-audio">
      <button onClick={() => void voice.play()} disabled={busy}>
        ♫ Hear Thai
      </button>
      <button onClick={() => void voice.play(true)} disabled={busy}>
        Slowly
      </button>
    </div>
  );
  return (
    <PracticeScope
      enabled={
        (screen === 'world' || screen === 'battle') &&
        !map &&
        !journal &&
        !bag &&
        !journeyBoard &&
        !growthMenu
      }
      onSeconds={(seconds) => persistTraining(addPracticeTime(readTraining(), seconds))}
    >
      <main className={`bk-game rpg-game rpg-screen-${screen}`}>
        <div className="bk-world" ref={host} />
        <div className="bk-vignette" />
        <div className="bk-grain" />
        <header className="rpg-header">
          <span className="rpg-logo">
            ✦ BANGKOK RIFT <small>THE LAST FERRY</small>
          </span>
          <nav aria-label="Adventure menu">
            <button
              onClick={() => saveSoundSettings({ ...sound, musicEnabled: !sound.musicEnabled })}
              aria-label={sound.musicEnabled ? 'Mute music' : 'Play music'}
            >
              {sound.musicEnabled ? '♫' : '♪'}
            </button>
            <button
              onClick={() => setJournal(true)}
              disabled={
                busy ||
                screen === 'battle' ||
                journeyVisit ||
                !!serviceHost ||
                eveningOpen ||
                lanternOpen ||
                !!reunionHost
              }
            >
              Journal
            </button>
            <button
              onClick={() => setJourneyBoard(true)}
              disabled={
                busy ||
                screen !== 'world' ||
                !!dialogue ||
                journeyVisit ||
                !!serviceHost ||
                eveningOpen ||
                lanternOpen ||
                !!reunionHost
              }
            >
              Journeys
            </button>
            <button
              onClick={() => setBag(true)}
              disabled={
                busy ||
                screen === 'battle' ||
                journeyVisit ||
                !!serviceHost ||
                eveningOpen ||
                lanternOpen ||
                !!reunionHost
              }
            >
              Bag · {save.coins} ◈
            </button>
            <button
              onClick={onTrain}
              disabled={
                busy ||
                screen === 'battle' ||
                journeyVisit ||
                !!serviceHost ||
                eveningOpen ||
                lanternOpen ||
                !!reunionHost
              }
            >
              Train at camp
            </button>
          </nav>
        </header>
        {screen === 'title' && (
          <section className="rpg-title">
            <p className="bk-eyebrow">BANGKOK · YOUR JOURNEY STARTS ON SUKHUMVIT</p>
            <h1>
              The city has
              <br />
              lost its <em>voice.</em>
            </h1>
            <p>
              Wake in a Sukhumvit hotel.
              <br />
              Six neighbourhoods wait outside.
              <br />
              Explore, speak, and fight beside Su to restore the last ferry.
            </p>
            <button
              className="bk-button bk-gold"
              onClick={() => {
                setScreen(save.battle ? 'battle' : 'world');
                setNotice('');
              }}
            >
              {save.flags.length || save.battle ? 'Continue adventure' : 'Step through the rift'}{' '}
              <span>→</span>
            </button>
            <div className="rpg-title-details">
              EXPLORE A 3D TOWN · MEET ITS PEOPLE
              <br />
              FIND TREASURE · FIGHT WITH WORDS
            </div>
          </section>
        )}
        {screen === 'world' && (
          <aside className="rpg-party-panel">
            <div>
              <span className="rpg-portrait">P</span>
              <section>
                <strong>
                  Patrick{' '}
                  <button
                    className="rpg-growth-trigger"
                    aria-label="Party growth"
                    disabled={
                      busy ||
                      !!dialogue ||
                      journeyVisit ||
                      !!serviceHost ||
                      eveningOpen ||
                      lanternOpen ||
                      !!reunionHost
                    }
                    onClick={() => setGrowthMenu(true)}
                  >
                    LV {growth.level}
                    {freeTalents > 0 ? ` · ${freeTalents} ✦` : ''}
                  </button>
                </strong>
                <div className="rpg-health" aria-label={`Party health ${save.hp} of 100`}>
                  <i style={{ width: `${save.hp}%` }} />
                </div>
                <small>
                  HP {save.hp} / 100 {has(save, 'chest') ? '· JADE WARD' : ''}
                </small>
              </section>
            </div>
            <div>
              <span className="rpg-portrait su">S</span>
              <section>
                <strong>
                  Su <small>COMPANION</small>
                </strong>
                <small>{`${save.learned.length} words discovered`}</small>
              </section>
            </div>
          </aside>
        )}
        {screen === 'world' &&
          !dialogue &&
          !journeyVisit &&
          !serviceHost &&
          !eveningOpen &&
          !lanternOpen &&
          !reunionHost && (
            <>
              <aside className="rpg-objective">
                <small>
                  {activeJourney && !activeJourney.paused
                    ? `TRAVEL MISSION ${activeJourney.id} · STOP ${activeJourney.stop + 1}/3`
                    : `${followedStory.kind.toUpperCase()} · ${followedStory.title.toUpperCase()}`}
                </small>
                <h2>{goal.text}</h2>
                {(!activeJourney || activeJourney.paused) && followedStory.destinations.length > 0 && (
                  <button onClick={() => walkQuest(followedStory.id, followedStory.destinations[0])}>
                    Walk to {followedStory.destinations[0].label} ↗
                  </button>
                )}
                {(save.escort.stage === 'following' || save.escort.stage === 'arrived') && (
                  <p className="escort-objective">
                    <strong>A WAY BACK TOGETHER</strong>
                    <br />
                    {save.escort.stage === 'following'
                      ? 'Walk with Nok to Dao in Sukhumvit.'
                      : 'Nok has arrived. Ask Dao about the route.'}
                  </p>
                )}
                <button
                  onClick={() => {
                    setMapArea(district?.id ?? 'riverside');
                    setMap(true);
                  }}
                >
                  Open town map ↗
                </button>
                {(!activeJourney || activeJourney.paused) && followedStory.id==='ferry' && (
                  <p className="rpg-story-encounters" aria-label="Main story battles">
                    {has(save,'murmur')?'✦':'◇'} Murmur · lantern spark<br/>
                    {has(save,'keeper')?'✦':'◇'} Keeper · river passage
                  </p>
                )}
                {activeJourney && !activeJourney.paused && (
                  <span className="journey-active-label">
                    {journeyDefinition.title} · {activeJourney.spoken} spoken attempts
                  </span>
                )}
              </aside>
              <div className="rpg-location">
                {district?.name.toUpperCase() ?? (byCanal ? 'BANGKOK · CANAL WALK' : 'BANGKOK · CITY WALKS')}
                <small>
                  {district?.theme ??
                    (byCanal
                      ? 'Hotel ← · Lumphini ↑ · Old Town →'
                      : 'Follow the lit paths between neighbourhoods')}
                </small>
              </div>
              <div className="rpg-explore-bar">
                <span>WASD / arrows · Click ground to walk</span>
                {save.escort.stage === 'arrived' &&
                  Math.hypot(save.position.x + 40, save.position.z - 17.5) < 2.5 && (
                    <button className="bk-button" onClick={() => talkEscort(true)}>
                      Ask Dao about Nok’s route
                    </button>
                  )}
                {near && !reunionReason(save, near) && (
                  <button className="bk-button" onClick={() => setReunionHost(near)}>
                    Continue A Promise Kept
                  </button>
                )}
                {near === eveningHost(save) && !eveningReason(save) && (
                  <button className="bk-button" onClick={() => setEveningOpen(true)}>
                    {eveningStep(save) === 'plan' ? 'Plan an evening with Su' : 'Continue our evening'}
                  </button>
                )}
                {near === 'artisan' && !lanternTradeReason(save) && (
                  <button className="bk-button" onClick={() => setLanternOpen(true)}>
                    Browse Arun’s lanterns
                  </button>
                )}
                {nearbyCanalStep && near !== 'canal-lantern' && (
                  <button className="bk-button" onClick={() => talkCanal(near!)}>
                    Talk about the canal lantern
                  </button>
                )}
                <button
                  className="bk-button bk-gold"
                  disabled={!near}
                  onClick={() => world.current?.interactNearby()}
                >
                  {near ? `E · ${actors.find((a) => a.id === near)?.name}` : 'Move closer to talk'}
                </button>
                <button className="rpg-guide" onClick={() => interactRef.current('su')}>
                  Talk to Su
                </button>
              </div>
              <div className="rpg-dpad" aria-label="Movement controls">
                {[
                  { name: 'Walk up', x: 0, z: -1, icon: '▲' },
                  { name: 'Walk left', x: -1, z: 0, icon: '◀' },
                  { name: 'Walk down', x: 0, z: 1, icon: '▼' },
                  { name: 'Walk right', x: 1, z: 0, icon: '▶' },
                ].map((d) => (
                  <button
                    key={d.name}
                    aria-label={d.name}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      world.current?.moveDirection(d.x, d.z);
                    }}
                    onPointerUp={() => world.current?.moveDirection(0, 0)}
                    onPointerCancel={() => world.current?.moveDirection(0, 0)}
                    onLostPointerCapture={() => world.current?.moveDirection(0, 0)}
                  >
                    {d.icon}
                  </button>
                ))}
              </div>
            </>
          )}
        {reunionHost && screen === 'world' && (
          <ReunionPanel
            key={`${reunionHost}:${reunionStep(save, reunionHost)}`}
            save={save}
            actor={reunionHost}
            onClose={() => setReunionHost(null)}
            onPractice={servicePractice}
            onAdvance={confirmReunion}
          />
        )}
        {lanternOpen && screen === 'world' && (
          <LanternTradePanel
            key={save.lantern.offer}
            save={save}
            onClose={() => setLanternOpen(false)}
            onPractice={servicePractice}
            onConfirm={confirmLantern}
          />
        )}
        {eveningOpen && screen === 'world' && (
          <EveningOutingPanel
            key={eveningStep(save)}
            save={save}
            onClose={() => setEveningOpen(false)}
            onPractice={servicePractice}
            onAdvance={confirmEvening}
          />
        )}
        {serviceHost && screen === 'world' && (
          <CityServicePanel
            key={serviceHost}
            host={serviceHost}
            save={save}
            onClose={() => setServiceHost(null)}
            onPractice={servicePractice}
            onUse={receiveService}
          />
        )}
        {dialogue && (
          <section className="rpg-dialogue" aria-label="Story conversation">
            <div className="rpg-dialogue-heading">
              <span>◆ {line?.speaker}</span>
              <small>
                {dialogue.index + 1} / {dialogue.lines.length}
              </small>
              <button
                onClick={() => {
                  setDialogue(null);
                  resetPrompt();
                }}
                disabled={busy}
                aria-label="Leave conversation"
              >
                ×
              </button>
            </div>
            <div className={`rpg-conversation-body ${phrase ? 'has-phrase' : ''}`} data-speaking-scroll>
              <div className="rpg-conversation-context">
                <p className="rpg-story-text">{line?.text}</p>
                {line && !answered && <CharacterVoice speaker={line.speaker} text={line.text} disabled={busy} />}
                {phrase && (
                  <>
                    <p className="rpg-lesson-label">SU TEACHES · {phrase.translation}</p>
                    <p className="rpg-thai" lang="th">
                      {phrase.targetPhrase}
                    </p>
                    <p className="rpg-roman">{phrase.romanization}</p>
                    {audioTools}
                    <small className="rpg-voice-message" role="status">
                      {voice.message ||
                        'Read each English meaning before choosing. Then practise your selected reply aloud.'}
                    </small>
                  </>
                )}
              </div>
              <div>
                {feedback && (
                  <>
                    <p className="rpg-feedback" role="status">
                      {feedback}
                    </p>
                    {answered && line?.response && (
                      <CharacterVoice speaker={line.responseSpeaker ?? line.speaker} text={line.response} disabled={busy} />
                    )}
                  </>
                )}
                {phrase && !answered ? (
                  <SpeakChoice
                    key={`${dialogue.actor}:${dialogue.index}`}
                    choices={choices}
                    onSubmit={answer}
                    onBusyChange={setChoiceBusy}
                    onPreview={voice.stopPlayback}
                  />
                ) : (
                  <button className="bk-button bk-gold" onClick={nextDialogue} disabled={busy}>
                    {dialogue.index + 1 < dialogue.lines.length
                      ? 'Continue'
                      : dialogue.reward === 'departed'
                        ? 'Board the ferry'
                        : dialogue.challenge
                          ? dialogue.challenge==='sentinel'?'Challenge the Waywarden':storyEncounters[dialogue.challenge].enter
                          : dialogue.escortStep
                            ? dialogue.escortStep === 'begin'
                              ? 'Walk with Nok'
                              : 'Complete the escort'
                            : dialogue.canalStep
                              ? {
                                  'canal-accepted': 'Accept the errand',
                                  'canal-paper': 'Receive the paper shade',
                                  'canal-frame': 'Receive the bamboo frame',
                                  'canal-restored': 'Restore the canal lantern',
                                }[dialogue.canalStep]
                              : 'Back to the adventure'}{' '}
                    <span>→</span>
                  </button>
                )}
                {phrase && !answered && (
                  <details
                    className="rpg-speaking-context"
                    key={`context:${dialogue.actor}:${dialogue.index}`}
                  >
                    <summary>Remember the situation</summary>
                    <p>{line?.text}</p>
                  </details>
                )}
              </div>
            </div>
          </section>
        )}
        {screen === 'battle' && save.battle && (
          <ExpeditionBattle
            battle={save.battle}
            onChange={(battle, practiced) => {
              let next = updateBattle(saveRef.current, battle);
              if (practiced) {
                persistTraining(
                  recordAttempt(readTraining(), practiced.id, practiced.spoken ? 'spoken' : 'choice', true),
                );
                if (!next.learned.includes(practiced.id))
                  next = { ...next, learned: [...next.learned, practiced.id], xp: next.xp + 5 };
              }
              setSave(next);
            }}
            onScene={(battle, target) => world.current?.setCombat(battle, target)}
            onCharge={(progress) => world.current?.setDefenseCharge(progress)}
            onLeave={() => {
              const b = saveRef.current.battle;
              setSave(leaveBattle(saveRef.current));
              world.current?.setCombat(null, null);
              setScreen('world');
              setNotice(
                b?.practice
                  ? 'Sparring finished. Story progress and supplies are unchanged.'
                  : b?.phase === 'victory'
                    ? b.id === 'sentinel'
                      ? 'WAYFINDER SEAL · Future battles begin with 20 resonance · +75 XP · +25 coins'
                      : b.id === 'keeper'
                        ? 'The river lantern is restored. Return to Niran!'
                        : 'Lantern spark acquired. Follow the journal to prepare the last ferry.'
                    : b?.phase === 'defeat'
                      ? 'You wake near the inn with 35 HP. Your quest items are safe.'
                      : 'Party regrouped. Rest at Mali’s inn if you need to.',
              );
            }}
          />
        )}
        {screen === 'crossing' && (
          <FerryCrossing
            onProgress={(p) => world.current?.setDeparture(p)}
            onArrive={() => {
              world.current?.setDeparture(1);
              setScreen('ending');
            }}
          />
        )}
        {screen === 'ending' && (
          <section className="rpg-ending">
            <p className="bk-eyebrow">CHAPTER ONE COMPLETE</p>
            <h1>
              The river
              <br />
              <em>remembers.</em>
            </h1>
            <p>
              The lantern shines. The ferry leaves the pier.
              <br />A handful of Thai became a room, a meal, and a way forward.
            </p>
            <div>
              <span>
                {save.learned.length}
                <small>WORDS DISCOVERED</small>
              </span>
              <span>
                {save.xp}
                <small>ADVENTURE XP</small>
              </span>
              <span>
                {save.visited.length} / {cityAreas.length}
                <small>AREAS VISITED</small>
              </span>
            </div>
            <button className="bk-button bk-gold" onClick={onTrain}>
              Practise your words at camp →
            </button>
            <button className="rpg-back" onClick={() => setScreen('world')}>
              Return to the riverside
            </button>
            <small className="rpg-chapter-note">
              There are still people to meet and neighbourhoods to revisit. The 30-day practice route is
              available at camp.
            </small>
          </section>
        )}
        {notice && screen !== 'title' && (
          <div className="rpg-toast" role="status">
            {notice}
          </div>
        )}
        {status === 'loading' && <div className="bk-loading">Preparing your travelling party…</div>}
        {(status === 'error' || status === 'fallback') && (
          <div className="bk-world-error">The 3D scene could not fully load. Reload to retry.</div>
        )}
        {saveError && (
          <div className="bk-save-error" role="alert">
            Progress could not save. Allow browser storage before closing this tab.
          </div>
        )}
        {journeyVisit && activeJourney && (
          <section className="rpg-dialogue journey-dialogue" aria-label="Travel conversation">
            <div className="rpg-dialogue-heading">
              <span>
                ◆ {journeyHosts[cityJourneys[activeJourney.id - 1].actors[activeJourney.stop]].name}
              </span>
              <small>YOUR WORDS OPEN THE CITY</small>
              <button
                aria-label="Leave travel conversation"
                disabled={busy}
                onClick={() => setJourneyVisit(false)}
              >
                ×
              </button>
            </div>
            <JourneyVisit
              key={journeyCursor(activeJourney)}
              active={activeJourney}
              onDone={(result) => finishJourneyStep(journeyCursor(activeJourney), result)}
              onMeaningHelp={() => {
                const s = saveRef.current;
                const journeys = markJourneyMeaningHelp(s.journeys, journeyCursor(activeJourney));
                if (journeys !== s.journeys) {
                  const next = { ...s, journeys };
                  saveRef.current = next;
                  setSave(next);
                }
              }}
              onBusy={setChoiceBusy}
            />
          </section>
        )}
        <Modal
          isOpen={journeyBoard}
          onClose={() => setJourneyBoard(false)}
          title="Your Bangkok passport"
          eyebrow={`${save.journeys.completed.length} / 30 OUTINGS COMPLETED`}
          className="bk-modal rpg-modal"
        >
          <section className="journey-board">
            <p className="bk-eyebrow">
              {activeJourney?.replay ? 'REHEARSAL' : 'TRAVEL MISSION'} {journeyDefinition.id}
              {activeJourney?.paused ? ' · PAUSED' : ''}
            </p>
            <h2>{journeyDefinition.title}</h2>
            <p>{journeyDefinition.story}</p>
            <ol className="journey-route">
              {journeyDefinition.actors.map((id, i) => (
                <li key={id} className={activeJourney && i < activeJourney.stop ? 'done' : ''}>
                  <span>{activeJourney && i < activeJourney.stop ? '✓' : `0${i + 1}`}</span>
                  <div>
                    <strong>{journeyHosts[id].name}</strong>
                    <small>{journeyHosts[id].scene}</small>
                  </div>
                </li>
              ))}
            </ol>
            <p>
              At each stop, use three lines in everyday situations. Newer phrases include guided practice;
              lines recalled on multiple earlier days start with an English-only attempt. Then try the lines
              in a different order. Hints stay available, and phrases due for review return in later outings.
            </p>
            {activeJourney && (
              <p role="status">
                Stop {activeJourney.stop + 1}/3 · {activeJourney.step}/6 attempts this stop ·{' '}
                {activeJourney.spoken} recorded speaking attempts · {activeJourney.recalled} self-checked
                recalls without hints
              </p>
            )}
            <div className="journey-board-actions">
              {!has(save, 'innkeeper') ? (
                <p>Check in with Mali at the hotel first. Your brass key unlocks these outings.</p>
              ) : activeJourney ? (
                <>
                  <button
                    className="bk-button bk-gold"
                    onClick={() => {
                      const s = saveRef.current,
                        a = s.journeys.active;
                      if (!a) return;
                      const next = { ...s, journeys: { ...s.journeys, active: { ...a, paused: false } } };
                      saveRef.current = next;
                      setSave(next);
                      const actor = actors.find((x) => x.id === cityJourneys[a.id - 1].actors[a.stop])!;
                      setMapArea(cityAreaAt(actor) ?? 'hotel');
                      setJourneyBoard(false);
                      setMap(true);
                    }}
                  >
                    {activeJourney.paused ? 'Resume mission · open map' : 'Find my next stop →'}
                  </button>
                  {!activeJourney.paused && (
                    <button
                      className="bk-button bk-outline"
                      onClick={() => {
                        setSave((s) => ({
                          ...s,
                          journeys: {
                            ...s.journeys,
                            active: s.journeys.active ? { ...s.journeys.active, paused: true } : null,
                          },
                        }));
                        setJourneyBoard(false);
                      }}
                    >
                      Pause mission · return to story
                    </button>
                  )}
                </>
              ) : (
                <>
                  {save.journeys.completed.length < 30 && (
                    <button className="bk-button bk-gold" onClick={() => startJourney()}>
                      Begin this outing →
                    </button>
                  )}
                  {!!save.journeys.completed.length && (
                    <button
                      className="bk-button bk-outline"
                      onClick={() => startJourney(save.journeys.completed.at(-1)!.id)}
                    >
                      Rehearse my last outing
                    </button>
                  )}
                </>
              )}
            </div>
            <p>
              <small>
                First completion: passport stamp, 60 XP, 20 coins and a rice parcel. Rehearsals save your
                practice without awarding the same supplies again.
              </small>
            </p>
            <div className="journey-hour">
              <strong>Make an hour of it, at your pace</strong>
              <br />
              10 minutes of review at camp · 20 minutes exploring and meeting people · 20 minutes speaking,
              listening and retrying · 10 minutes recalling and comparing. This is a suggested routine; the
              outing has no timer.
            </div>
            <TodayPractice onReview={onTrain} />
            <h3>Collected stamps</h3>
            <div className="journey-passport">
              {save.journeys.completed.length ? (
                save.journeys.completed.map((c) => (
                  <span className="journey-stamp" key={c.id}>
                    ✦ {c.id} · {cityJourneys[c.id - 1].stamp}
                    <br />
                    {c.spoken} recorded · {c.recalled} recalled
                  </span>
                ))
              ) : (
                <p className="journey-empty">Your first stamp is waiting out in the city.</p>
              )}
            </div>
          </section>
        </Modal>
        <Modal
          isOpen={map}
          onClose={() => setMap(false)}
          title="Bangkok · the city of returning words"
          eyebrow={`${save.visited.length} / 6 DISTRICTS DISCOVERED`}
          className="bk-modal rpg-modal city-map-modal"
        >
          <p>Walk the city with Su. Select a district, then choose a person or a route.</p>
          <div className="rpg-map city-map">
            <svg viewBox="-65 -8 120 50" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M-45 13H43 M-20 13V39 M1 13V0 M36 13V39 M-54 28V14 M-54 28H-44V39H37 M-9 13V39"
                fill="none"
                stroke="#729591"
                strokeWidth="1.2"
                strokeDasharray="1 1"
              />
            </svg>
            {cityAreas.map((a) => (
              <button
                key={a.id}
                data-area={a.id}
                className={mapArea === a.id ? 'current' : ''}
                style={{
                  left: `${((a.center.x + 65) / 120) * 100}%`,
                  top: `${((a.center.z + 8) / 50) * 100}%`,
                }}
                onClick={() => setMapArea(a.id)}
              >
                <b>{save.visited.includes(a.id) ? '◆' : '◇'}</b>
                <span>{a.name}</span>
              </button>
            ))}
            <i
              className="city-you"
              title="Your position"
              style={{
                left: `${((save.position.x + 65) / 120) * 100}%`,
                top: `${((save.position.z + 8) / 50) * 100}%`,
              }}
            >
              ●
            </i>
          </div>
          <section className="city-map-details">
            <h3>{cityAreas.find((a) => a.id === mapArea)?.name}</h3>
            <p>{cityAreas.find((a) => a.id === mapArea)?.hint}</p>
            <div className="city-map-actions">
              <button
                onClick={() => {
                  setMap(false);
                  requestAnimationFrame(() => {
                    world.current?.configureAdventure(
                      saveRef.current,
                      {
                        interact: (id) => interactRef.current(id),
                        near: setNear,
                        move: reportWorldMove,
                      },
                      false,
                    );
                    world.current?.travelPoint(canalWalk);
                  });
                }}
              >
                Walk to the canal
              </button>
              <button
                onClick={() => {
                  setMap(false);
                  requestAnimationFrame(() => {
                    world.current?.configureAdventure(
                      saveRef.current,
                      {
                        interact: (id) => interactRef.current(id),
                        near: setNear,
                        move: reportWorldMove,
                      },
                      false,
                    );
                    world.current?.travelPoint(cityAreas.find((a) => a.id === mapArea)!.center);
                  });
                }}
              >
                Walk to {cityAreas.find((a) => a.id === mapArea)?.name}
              </button>
              {has(save, 'station') && (
                <button
                  disabled={!save.visited.includes(mapArea) || save.escort.stage === 'following'}
                  onClick={() => {
                    setSave((s) => transitTo(s, mapArea));
                    setMap(false);
                    setNotice('City pass · returning to a familiar neighbourhood');
                  }}
                >
                  Use city pass{' '}
                  {save.escort.stage === 'following'
                    ? '· walk with Nok first'
                    : save.visited.includes(mapArea)
                      ? ''
                      : '· visit on foot first'}
                </button>
              )}
            </div>
            <p>
              The southern canal walk links the hotel, Lumphini and Old Town. Take the smaller street beside
              the park to return to the main road.
            </p>
            <div className="city-contacts">
              {actors
                .filter(
                  (a) =>
                    a.id !== 'su' &&
                    a.id !== 'traveler' &&
                    cityAreaAt(a) === mapArea &&
                    (!discoveryFor(a.id) || has(save, a.id)),
                )
                .map((a) => (
                  <button
                    key={a.id}
                    data-area={a.id}
                    onClick={() => {
                      setMap(false);
                      requestAnimationFrame(() => {
                        world.current?.configureAdventure(
                          saveRef.current,
                          {
                            interact: (id) => interactRef.current(id),
                            near: setNear,
                            move: reportWorldMove,
                          },
                          false,
                        );
                        world.current?.travelTo(a.id);
                      });
                    }}
                  >
                    {has(save, a.id) ? '✓' : '◇'} {a.name}
                    {goal.actor === a.id
                      ? activeJourney && !activeJourney.paused
                        ? ' · TRAVEL MISSION'
                        : ' · MAIN QUEST'
                      : ''}
                  </button>
                ))}
            </div>
          </section>
          {has(save, 'innkeeper') && (
            <section className="city-road-challenge escort-errand">
              <div>
                <strong>A Way Back Together</strong>
                <p>{escortStatus(save)}</p>
              </div>
              <div className="city-map-actions">
                <button onClick={() => walkEscort(false)}>
                  {save.escort.stage === 'complete' ? 'Visit Nok at the station' : 'Find Nok'}
                </button>
                {(save.escort.stage === 'following' || save.escort.stage === 'arrived') && (
                  <button onClick={() => walkEscort(true)}>Walk together to Dao</button>
                )}
              </div>
            </section>
          )}
          {has(save, 'innkeeper') && (
            <section className="city-road-challenge canal-errand">
              <div>
                <strong>A Light for Late Walkers</strong>
                <p>{canalStatus(save)}</p>
                <small>At Pim or Arun, choose “Talk about the canal lantern” when you arrive.</small>
              </div>
              <div className="city-map-actions">
                {canalFlags
                  .filter((step) => canalStepFor(save, canalHost[step]) === step)
                  .map((step) => (
                    <button key={step} onClick={() => walkCanalErrand(canalHost[step])}>
                      {step === 'canal-paper'
                        ? 'Visit Pim for paper'
                        : step === 'canal-frame'
                          ? 'Visit Arun for a frame'
                          : 'Visit the canal lantern'}
                    </button>
                  ))}
              </div>
            </section>
          )}
          <p className="rpg-map-caption">
            An imagined, condensed Bangkok. Districts connect on foot; the city pass returns you to places you
            have explored.
          </p>
          {has(save, 'station') && (
            <div className="city-road-challenge">
              <div>
                <strong>
                  {has(save, 'sentinel') ? '✥ The crossroads are clear' : '✥ An invitation on the road'}
                </strong>
                <p>
                  {has(save, 'sentinel')
                    ? 'Wayfinder Seal equipped · future battles begin with 20 resonance.'
                    : 'A turning compass waits between the riverside and Yaowarat. An optional battle rewards preparation and teamwork.'}
                </p>
              </div>
              <button className="bk-button" onClick={findWaystone}>
                Find the crossroads waystone
              </button>
            </div>
          )}
        </Modal>
        <Modal
          isOpen={bag}
          onClose={() => setBag(false)}
          title="Your travelling bag"
          eyebrow={`${save.coins} COINS · PARTY HP ${save.hp}/100`}
          className="bk-modal rpg-modal"
        >
          <button
            className="bk-button bk-gold rpg-growth-entry"
            onClick={() => {
              setBag(false);
              setGrowthMenu(true);
            }}
          >
            Develop the party · {freeTalents} talent points available
          </button>
          <div className="rpg-bag-items">
            <button onClick={() => consumeItem('rice')} disabled={!save.rice || save.hp === 100}>
              <b>▣ Rice parcel ×{save.rice}</b>
              <span>Restore 45 HP</span>
            </button>
            <button
              onClick={() => consumeItem('tea')}
              disabled={!save.tea || (save.hp === 100 && screen !== 'battle')}
            >
              <b>♧ Thai tea ×{save.tea}</b>
              <span>Restore 20 HP · full battle focus</span>
            </button>
            {has(save, 'cook') && (
              <button
                onClick={() => {
                  setBag(false);
                  setMapArea('yaowarat');
                  setMap(true);
                }}
              >
                <b>Find provisions in Yaowarat</b>
                <span>Visit Uncle Lek · rice parcels cost 10 coins</span>
              </button>
            )}
            {has(save, 'gardener') && (
              <button
                onClick={() => {
                  setBag(false);
                  setMapArea('lumphini');
                  setMap(true);
                }}
              >
                <b>Find tea in Lumphini</b>
                <span>Visit Pim · a flask costs 8 coins</span>
              </button>
            )}
          </div>
          <h3>Key items</h3>
          <ul className="rpg-key-items">
            {save.lantern.owned && (
              <li>
                ✦ {lanternName(save.lantern)} — carried by Su · reveal city memories from farther away · paid{' '}
                {save.lantern.paid} game coins
              </li>
            )}
            {has(save, 'canal-paper') && !has(save, 'canal-restored') && (
              <li>▱ Pim’s paper shade — for the canal lantern</li>
            )}
            {has(save, 'canal-frame') && !has(save, 'canal-restored') && (
              <li>◇ Arun’s bamboo frame — for the canal lantern</li>
            )}
            {has(save, 'canal-restored') && <li>✦ A Light for Late Walkers — canal lantern restored</li>}
            {hasRiverCharm(save.flags) && (
              <li>✦ River Charm — equipped · restore 15 HP after a story battle victory</li>
            )}
            {has(save, 'innkeeper') && <li>🗝 Brass room key — opens the old travel chest</li>}
            {has(save, 'chest') && <li>◇ Jade Ward — equipped · reduces spirit damage by 3</li>}
            {has(save, 'cook') && !has(save, 'ferry') && <li>▣ Lek’s supper — deliver to Niran</li>}
            {has(save, 'ferry') && <li>▤ Ferry pass — two seats across the river</li>}
            {has(save, 'murmur') && <li>✦ Lantern spark — recovered from the wisp</li>}
            {has(save, 'sentinel') && <li>✥ Wayfinder Seal — start battles with 20 resonance</li>}
            {!save.flags.length && <li>A traveller’s empty notebook. Its story is still unwritten.</li>}
          </ul>
        </Modal>
        <Modal
          isOpen={growthMenu}
          onClose={() => setGrowthMenu(false)}
          title="The travelling party"
          eyebrow="TALENTS · PREPARE FOR YOUR NEXT ENCOUNTER"
          className="bk-modal rpg-modal"
        >
          <PartyGrowth
            xp={save.xp}
            selected={save.talents ?? []}
            onToggle={(id) => setSave((s) => toggleTalent(s, id))}
          />
          <button className="bk-button bk-outline" onClick={beginSparring}>Battle practice</button>
          <p>Optional rehearsal with Su. Story encounters happen out in the city and use your travelling party’s supplies.</p>
        </Modal>
        <Modal
          isOpen={journal}
          onClose={() => setJournal(false)}
          title="Your adventures"
          eyebrow="QUEST JOURNAL"
          className="bk-modal rpg-modal"
        >
          <p className="rpg-journal-story">
            Find your place in a city that is losing its words. Help its people, restore the river lantern,
            and catch the ferry with Su.
          </p>
          <QuestJournal save={save} onTrack={(id) => setSave((s) => trackQuest(s, id))} onWalk={walkQuest} />
          <p>
            <b>Optional:</b> find and unlock the old travel chest for a Jade Ward.
          </p>
          <section className="rpg-discoveries">
            <h3>Explorer’s journal · {discoveryCount(save.flags)} / 6 city memories</h3>
            <p>
              Search the side paths for small stories. Find all six to earn a River Charm that restores 15 HP
              after each story battle victory.
            </p>
            {discoveries.map((d) => (
              <details key={d.id} open={has(save, d.id)}>
                <summary>
                  {has(save, d.id) ? '✦' : '◇'} {cityAreas.find((a) => a.id === d.area)?.name} ·{' '}
                  {has(save, d.id) ? d.name : 'An undiscovered memory'}
                </summary>
                <p>{has(save, d.id) ? d.story : d.hint}</p>
                {has(save, d.id) && (
                  <small>
                    Practised: {phrases[d.phrase].translation} · {phrases[d.phrase].targetPhrase}
                  </small>
                )}
              </details>
            ))}
          </section>
          <h3>Words discovered</h3>
          <div className="rpg-journal-words">
            {save.learned.map(
              (id) =>
                phrases[id] && (
                  <div key={id}>
                    <strong lang="th">{phrases[id].targetPhrase}</strong>
                    <span>{phrases[id].translation}</span>
                  </div>
                ),
            )}
          </div>
          <p className="rpg-chapter-note">
            Explore six connected districts and their local stories. Camp has the 30-day practice route. Voice
            recordings are self-checks; they do not grade Thai tones.
          </p>
        </Modal>
      </main>
    </PracticeScope>
  );
}
