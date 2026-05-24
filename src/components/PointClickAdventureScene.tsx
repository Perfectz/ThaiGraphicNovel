import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  adventureVerbs,
  getInventoryItem,
  getMissingInventoryItems,
  getPointClickRoom,
  levelTwoRooms,
  type AdventureCommand,
  type AdventureConversationId,
  type AdventureHotspot,
  type AdventureVerb,
  type InventoryItemId,
  type PointClickRoomId,
} from '../data/pointClickLevel2';
import { getVoiceJudgeMode, VOICE_JUDGE_MODE_CHANGED_EVENT, type VoiceJudgeMode } from '../services/openAiSettings';
import {
  createPronunciationSession,
  type PronunciationPrompt,
  type PronunciationSession,
  type PronunciationVerdict,
} from '../services/realtimePronunciation';
import { createWhisperPronunciationSession } from '../services/whisperPronunciation';
import { useGameStore } from '../store/gameStore';
import { SuPronunciationJudge } from './SuPronunciationJudge';

type ActiveAdventureCommand = {
  hotspot: AdventureHotspot;
  command: AdventureCommand;
};

type ActiveAdventureConversation = ActiveAdventureCommand & {
  conversationId: AdventureConversationId;
  turnIndex: number;
};

const requiredInventory: InventoryItemId[] = ['wallet', 'passport', 'phone', 'reservationPaper', 'keycard'];
const roomAspectRatio = 1672 / 941;

export function PointClickAdventureScene() {
  const finishPointClickAdventure = useGameStore((state) => state.finishPointClickAdventure);
  const [roomId, setRoomId] = useState<PointClickRoomId>('lobby');
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<ActiveAdventureCommand | null>(null);
  const [activeConversation, setActiveConversation] = useState<ActiveAdventureConversation | null>(null);
  const [completedConversations, setCompletedConversations] = useState<AdventureConversationId[]>([]);
  const [inventory, setInventory] = useState<InventoryItemId[]>([]);
  const [message, setMessage] = useState('Find the five check-in items. Click a hotspot, choose a verb, then say the full Thai sentence.');
  const [voiceStatus, setVoiceStatus] = useState('Choose a command to practice.');
  const [voiceError, setVoiceError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasVoiceCoach, setHasVoiceCoach] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceJudgeMode>(() => getVoiceJudgeMode());
  const [verdict, setVerdict] = useState<PronunciationVerdict | null>(null);
  const room = getPointClickRoom(roomId);
  const selectedHotspot = useMemo(
    () => room.hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null,
    [room.hotspots, selectedHotspotId],
  );
  const pronunciationSession = useRef<PronunciationSession | null>(null);
  const connectionPromise = useRef<Promise<PronunciationSession | null> | null>(null);
  const pressedSpeakPointers = useRef<Set<number>>(new Set());
  const activeCommandRef = useRef<ActiveAdventureCommand | null>(null);
  const activeConversationRef = useRef<ActiveAdventureConversation | null>(null);
  const completionTimer = useRef<number | null>(null);
  const activeConversationTurn = activeConversation?.command.conversation?.[activeConversation.turnIndex] ?? null;
  const pronunciationPrompt = useMemo<PronunciationPrompt>(
    () =>
      activeConversationTurn
        ? activeConversationTurn.response
        : activeCommand
        ? {
            targetPhrase: activeCommand.command.targetPhrase,
            romanization: activeCommand.command.romanization,
            phoneticSpelling: activeCommand.command.phoneticSpelling,
            translation: activeCommand.command.translation,
          }
        : {
            targetPhrase: 'ผมดูครับ',
            romanization: 'phom duu khrap',
            phoneticSpelling: 'pom doo khrap',
            translation: 'I look.',
          },
    [activeCommand, activeConversationTurn],
  );

  useEffect(() => {
    activeCommandRef.current = activeCommand;
    activeConversationRef.current = activeConversation;
    pronunciationSession.current?.updatePrompt(pronunciationPrompt);
    if ((activeCommand || activeConversation) && pronunciationSession.current) {
      setVoiceStatus(activeConversation ? 'Conversation response ready. Hold to answer in Thai.' : 'Command ready. Hold to say the Thai sentence.');
    }
  }, [activeCommand, activeConversation, pronunciationPrompt]);

  useEffect(() => {
    function syncVoiceMode() {
      setVoiceMode(getVoiceJudgeMode());
    }

    window.addEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
    window.addEventListener('focus', syncVoiceMode);
    return () => {
      window.removeEventListener(VOICE_JUDGE_MODE_CHANGED_EVENT, syncVoiceMode);
      window.removeEventListener('focus', syncVoiceMode);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (completionTimer.current !== null) {
        window.clearTimeout(completionTimer.current);
      }
      pronunciationSession.current?.disconnect();
      pronunciationSession.current = null;
    };
  }, []);

  function enterRoom(nextRoomId: PointClickRoomId) {
    if (nextRoomId === roomId) return;
    const nextRoom = getPointClickRoom(nextRoomId);
    setRoomId(nextRoomId);
    setSelectedHotspotId(null);
    setActiveCommand(null);
    setActiveConversation(null);
    setVerdict(null);
    setVoiceError('');
    setMessage(nextRoom.description);
  }

  function selectHotspot(hotspot: AdventureHotspot) {
    setSelectedHotspotId(hotspot.id);
    setActiveCommand(null);
    setActiveConversation(null);
    setVerdict(null);
    setVoiceError('');
    setMessage(`${hotspot.label}: choose a command, then say the full Thai sentence.`);
  }

  function selectCommand(verb: AdventureVerb) {
    if (!selectedHotspot) return;
    const command = selectedHotspot.commands[verb];
    if (!command) {
      setMessage(`${selectedHotspot.label} does not respond to ${verb}.`);
      return;
    }

    if (command.requiresConversation && !completedConversations.includes(command.requiresConversation)) {
      setActiveCommand(null);
      setActiveConversation(null);
      setVerdict(null);
      setVoiceError('');
      setMessage(command.conversationBlockedText ?? 'Complete the required conversation first.');
      return;
    }

    const missingItems = getMissingInventoryItems(inventory, command.requiresItems);
    if (missingItems.length > 0) {
      setActiveCommand(null);
      setActiveConversation(null);
      setVerdict(null);
      setVoiceError('');
      setMessage(command.blockedText ?? `You still need ${formatInventoryList(missingItems)}.`);
      return;
    }

    setActiveCommand({ hotspot: selectedHotspot, command });
    setActiveConversation(null);
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus(hasVoiceCoach ? 'Command ready. Hold to say the Thai sentence.' : 'Connect the AI mic when you are ready.');
    setMessage(`Say: ${command.romanization}`);
  }

  async function connectVoiceCoach(): Promise<PronunciationSession | null> {
    if (pronunciationSession.current) return pronunciationSession.current;
    if (connectionPromise.current) return connectionPromise.current;

    setIsConnecting(true);
    setVoiceError('');
    setVerdict(null);
    const selectedMode = getVoiceJudgeMode();
    setVoiceMode(selectedMode);

    connectionPromise.current = (async () => {
      const createSession = selectedMode === 'whisper' ? createWhisperPronunciationSession : createPronunciationSession;
      const session = await createSession({
        prompt: pronunciationPrompt,
        onStatus: setVoiceStatus,
        onError: (nextMessage) => {
          setVoiceError(nextMessage);
          setVoiceStatus('Voice coach needs another try.');
        },
        onVerdict: (nextVerdict) => {
          setVerdict(nextVerdict);
          if (!nextVerdict.pass) {
            setVoiceStatus('Pronunciation needs another try.');
            return;
          }

          setVoiceStatus('Command accepted. The action succeeds.');
          const acceptedConversation = activeConversationRef.current;
          if (acceptedConversation) {
            advanceConversation(acceptedConversation);
            return;
          }

          const acceptedCommand = activeCommandRef.current;
          if (acceptedCommand) {
            if (acceptedCommand.command.conversationId && acceptedCommand.command.conversation?.length) {
              startConversation(acceptedCommand);
              return;
            }

            executeCommand(acceptedCommand);
          }
        },
      });
      pronunciationSession.current = session;
      setHasVoiceCoach(true);
      return session;
    })();

    try {
      return await connectionPromise.current;
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : String(error));
      setVoiceStatus(`${selectedMode === 'whisper' ? 'Local Whisper' : 'Realtime'} voice coach could not connect.`);
      setHasVoiceCoach(false);
      return null;
    } finally {
      setIsConnecting(false);
      connectionPromise.current = null;
    }
  }

  function startVoiceAttempt(session = pronunciationSession.current) {
    if (!session || (!activeCommand && !activeConversation) || isRecording) return;
    setVoiceError('');
    setVerdict(null);
    session.updatePrompt(pronunciationPrompt);
    session.startRecording();
    setIsRecording(true);
  }

  function stopVoiceAttempt() {
    if (!pronunciationSession.current || !isRecording) return;
    pronunciationSession.current.stopRecording();
    setIsRecording(false);
  }

  function startVoiceAttemptWithPointerCapture(event: PointerEvent<HTMLButtonElement>) {
    if ((!activeCommand && !activeConversation) || !pronunciationSession.current) return;
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    pressedSpeakPointers.current.add(pointerId);
    startVoiceAttempt(pronunciationSession.current);
  }

  function stopVoiceAttemptWithPointerCapture(event: PointerEvent<HTMLButtonElement>) {
    pressedSpeakPointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopVoiceAttempt();
  }

  function startConversation({ hotspot, command }: ActiveAdventureCommand) {
    if (!command.conversationId || !command.conversation?.length) {
      executeCommand({ hotspot, command });
      return;
    }

    const nextConversation = {
      hotspot,
      command,
      conversationId: command.conversationId,
      turnIndex: 0,
    };
    const firstTurn = command.conversation[0];
    setActiveCommand(null);
    setActiveConversation(nextConversation);
    setVerdict(null);
    setVoiceError('');
    setVoiceStatus(hasVoiceCoach ? 'Conversation response ready. Hold to answer in Thai.' : 'Connect the AI mic when you are ready.');
    setMessage(`${firstTurn.npcSpeaker}: ${firstTurn.npcEnglish} Say: ${firstTurn.response.romanization}`);
  }

  function advanceConversation(conversation: ActiveAdventureConversation) {
    const turns = conversation.command.conversation ?? [];
    const currentTurn = turns[conversation.turnIndex];
    const nextTurnIndex = conversation.turnIndex + 1;
    const nextTurn = turns[nextTurnIndex];

    if (nextTurn) {
      setActiveConversation({
        ...conversation,
        turnIndex: nextTurnIndex,
      });
      setVerdict(null);
      setMessage(`${currentTurn?.successText ?? 'Good response.'} ${nextTurn.npcSpeaker}: ${nextTurn.npcEnglish} Say: ${nextTurn.response.romanization}`);
      setVoiceStatus('Next conversation response ready. Hold to answer in Thai.');
      return;
    }

    setCompletedConversations((currentConversations) =>
      currentConversations.includes(conversation.conversationId)
        ? currentConversations
        : [...currentConversations, conversation.conversationId],
    );
    setActiveConversation(null);
    setActiveCommand(null);
    setMessage(conversation.command.conversationCompleteText ?? conversation.command.successText);
    setVoiceStatus('Conversation complete. Continue the check-in task.');
  }

  function executeCommand({ command }: ActiveAdventureCommand) {
    if (command.givesItem) {
      setInventory((currentInventory) => {
        if (currentInventory.includes(command.givesItem as InventoryItemId)) return currentInventory;
        return [...currentInventory, command.givesItem as InventoryItemId];
      });
    }

    setMessage(command.successText);
    if (command.completesAdventure) {
      completionTimer.current = window.setTimeout(() => {
        finishPointClickAdventure();
      }, 800);
    }
  }

  const inventoryCount = inventory.length;
  const activeCommandMissingItems = activeCommand
    ? getMissingInventoryItems(inventory, activeCommand.command.requiresItems)
    : [];
  const activeConversationProgress = activeConversation?.command.conversation
    ? `${activeConversation.turnIndex + 1}/${activeConversation.command.conversation.length}`
    : '';
  const activeSpeechRomanization = activeConversationTurn?.response.romanization ?? activeCommand?.command.romanization;
  const roomFrameStyle = {
    '--adventure-room-aspect': String(roomAspectRatio),
  } as CSSProperties;

  return (
    <section className="absolute inset-0 z-40 overflow-hidden bg-slate-950 text-slate-50">
      <img
        src={room.background}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-55 blur-md"
        decoding="async"
        draggable={false}
      />

      <div className="adventure-room-frame" style={roomFrameStyle}>
        <img
          src={room.background}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          decoding="async"
          draggable={false}
        />

        <div className="absolute inset-0">
          {room.hotspots.map((hotspot) => {
            const isSelected = hotspot.id === selectedHotspotId;
            const collected = hotspot.kind === 'item' && inventory.includes(hotspot.id as InventoryItemId);
            const isBottomAnchored = hotspot.anchor === 'bottom';
            const hitboxAspectRatio = hotspot.kind === 'person' ? '1 / 1.72' : '1 / 1';
            const hitboxTransform = isBottomAnchored ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)';
            return (
              <button
                key={hotspot.id}
                type="button"
                onClick={() => selectHotspot(hotspot)}
                className={`group absolute z-20 grid place-items-center rounded-full border-2 transition ${
                  isSelected
                    ? 'border-yellow-200 bg-yellow-300/20 shadow-[0_0_0_6px_rgba(250,204,21,0.18),0_18px_42px_rgba(15,23,42,0.35)]'
                    : 'border-white/50 bg-slate-950/16 shadow-[0_12px_32px_rgba(15,23,42,0.22)] hover:border-cyan-100 hover:bg-cyan-200/18'
                } ${collected ? 'opacity-45 grayscale' : ''}`}
                style={{
                  left: `${hotspot.x}%`,
                  top: `${hotspot.y}%`,
                  width: `clamp(${hotspot.kind === 'person' ? '5rem' : '2.75rem'}, ${hotspot.width}%, ${
                    hotspot.kind === 'person' ? '13rem' : '6rem'
                  })`,
                  aspectRatio: hitboxAspectRatio,
                  transform: hitboxTransform,
                }}
                aria-label={hotspot.label}
              >
                {hotspot.sprite ? (
                  <img
                    src={hotspot.sprite}
                    alt={hotspot.spriteAlt ?? hotspot.label}
                    className={`pointer-events-none h-full w-full object-contain drop-shadow-[0_18px_18px_rgba(2,6,23,0.42)] ${hotspot.spriteClassName ?? ''}`}
                    draggable={false}
                  />
                ) : null}
                <span className="pointer-events-none absolute left-1/2 top-full mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/88 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-lg group-hover:block group-focus-visible:block">
                  {collected ? `${hotspot.label} collected` : hotspot.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(2,6,23,0.16),rgba(2,6,23,0.08)_35%,rgba(2,6,23,0.58)),repeating-linear-gradient(180deg,rgba(255,255,255,0.035)_0,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_5px)]" />

      <header className="pointer-events-none absolute left-3 right-32 top-3 z-30 flex items-start justify-between gap-3 sm:left-6 sm:right-44 sm:top-5">
        <div className="pointer-events-auto rounded-lg border border-cyan-100/40 bg-slate-950/72 px-3 py-2 shadow-2xl backdrop-blur-md sm:px-4">
          <p className="font-display text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Stage 2 Adventure</p>
          <p className="mt-0.5 text-base font-black leading-tight text-white sm:text-lg">{room.title}</p>
          <p className="max-w-[18rem] text-[11px] font-bold leading-snug text-cyan-50/82 sm:max-w-lg">{room.description}</p>
        </div>

        <nav className="pointer-events-auto grid grid-cols-3 gap-1 rounded-lg border border-white/24 bg-slate-950/70 p-1 shadow-2xl backdrop-blur-md">
          {levelTwoRooms.map((nextRoom) => (
            <button
              key={nextRoom.id}
              type="button"
              onClick={() => enterRoom(nextRoom.id)}
              className={`rounded-md px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition sm:px-3 ${
                nextRoom.id === roomId ? 'bg-cyan-300 text-slate-950' : 'bg-white/10 text-white hover:bg-white/22'
              }`}
            >
              {nextRoom.shortTitle}
            </button>
          ))}
        </nav>
      </header>

      <section className="pointer-events-auto absolute inset-x-3 bottom-[var(--vn-panel-bottom)] z-50 grid max-h-[min(20rem,48dvh)] gap-2 overflow-y-auto rounded-xl border border-cyan-100/42 bg-slate-950/82 p-3 text-white shadow-2xl backdrop-blur-md sm:inset-x-6 sm:grid-cols-[minmax(0,0.95fr)_minmax(14rem,0.6fr)_minmax(17rem,0.78fr)] lg:inset-x-10">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-100/32 bg-cyan-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-950">
              {selectedHotspot?.label ?? 'No Hotspot'}
            </span>
            <span className="text-[11px] font-bold leading-snug text-cyan-50/82">{message}</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {adventureVerbs.map((verb) => {
              const command = selectedHotspot?.commands[verb.id] ?? null;
              const missingItems = command ? getMissingInventoryItems(inventory, command.requiresItems) : [];
              const disabled = !selectedHotspot || !command;
              const blocked = missingItems.length > 0;
              const isActive =
                activeCommand !== null &&
                activeCommand.hotspot.id === selectedHotspot?.id &&
                activeCommand.command.verb === verb.id;
              return (
                <button
                  key={verb.id}
                  type="button"
                  onClick={() => selectCommand(verb.id)}
                  disabled={disabled}
                  className={`vn-action-button min-h-12 px-2 py-2 text-left text-[11px] font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none ${
                    isActive
                      ? 'bg-yellow-300 text-slate-950'
                      : blocked
                        ? 'bg-orange-200 text-orange-950'
                        : 'bg-white text-slate-950'
                  }`}
                >
                  {verb.label}
                  <span className="mt-0.5 block text-[9px] normal-case tracking-normal opacity-75">
                    {command ? (blocked ? 'need item' : command.label) : 'n/a'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 rounded-lg border border-white/18 bg-white/10 p-2">
            {activeConversation && activeConversationTurn ? (
              <>
                <div className="mb-2 rounded-md border border-cyan-100/24 bg-cyan-100/12 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-display text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                      Hostess {activeConversationProgress}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white/68">Listen</p>
                  </div>
                  <p className="text-base font-black leading-tight text-white">{activeConversationTurn.npcLineThai}</p>
                  <p className="text-xs font-black leading-tight text-cyan-100">{activeConversationTurn.npcRomanization}</p>
                  <p className="mt-1 text-xs font-bold leading-snug text-white/76">{activeConversationTurn.npcEnglish}</p>
                </div>
                <p className="font-display text-[10px] font-black uppercase tracking-[0.14em] text-yellow-200">Patrick responds</p>
                <p className="text-lg font-black leading-tight text-white sm:text-xl">{activeConversationTurn.response.targetPhrase}</p>
                <p className="text-sm font-black leading-tight text-cyan-100 sm:text-base">{activeConversationTurn.response.romanization}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-50/72">
                  Phonetic: {activeConversationTurn.response.phoneticSpelling}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-white/78">{activeConversationTurn.response.translation}</p>
              </>
            ) : activeCommand ? (
              <>
                <p className="text-lg font-black leading-tight text-white sm:text-xl">{activeCommand.command.targetPhrase}</p>
                <p className="text-sm font-black leading-tight text-cyan-100 sm:text-base">{activeCommand.command.romanization}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-50/72">
                  Phonetic: {activeCommand.command.phoneticSpelling}
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-white/78">{activeCommand.command.translation}</p>
                {activeCommandMissingItems.length > 0 ? (
                  <p className="mt-1 text-xs font-black text-orange-200">Need: {formatInventoryList(activeCommandMissingItems)}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm font-bold leading-snug text-white/76">
                Select an item or character, then pick Look, Take, Use, or Talk to reveal the Thai command sentence.
              </p>
            )}
          </div>
        </div>

        <div className="grid content-start gap-2">
          <div className="rounded-lg border border-white/18 bg-white/10 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Inventory</p>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/72">{inventoryCount}/5</p>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {requiredInventory.map((itemId) => {
                const item = getInventoryItem(itemId);
                const collected = inventory.includes(itemId);
                return (
                  <div
                    key={itemId}
                    className={`grid aspect-square place-items-center rounded-md border p-1 ${
                      collected ? 'border-cyan-200 bg-cyan-100/88' : 'border-white/14 bg-slate-950/40 opacity-55'
                    }`}
                    title={item.label}
                  >
                    <img src={item.sprite} alt={item.label} className="max-h-full max-w-full object-contain" draggable={false} />
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void connectVoiceCoach()}
            disabled={isConnecting || hasVoiceCoach}
            className="vn-action-button bg-emerald-300 px-3 py-2 text-left text-xs font-black uppercase tracking-[0.12em] text-emerald-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
          >
            {hasVoiceCoach ? `${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} Connected` : `Connect ${voiceMode === 'whisper' ? 'Whisper' : 'Realtime'} Mic`}
          </button>

          <button
            type="button"
            onPointerDown={startVoiceAttemptWithPointerCapture}
            onPointerUp={stopVoiceAttemptWithPointerCapture}
            onPointerCancel={stopVoiceAttemptWithPointerCapture}
            disabled={(!activeCommand && !activeConversation) || !hasVoiceCoach || isConnecting}
            className={`vn-action-button px-3 py-2 text-left text-xs font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none ${
              isRecording ? 'bg-red-500 text-white' : 'bg-yellow-300 text-slate-950'
            }`}
          >
            {isRecording ? 'Release To Judge' : activeConversation ? 'Hold To Answer' : 'Hold To Say Command'}
            <span className="mt-0.5 block text-[10px] normal-case tracking-normal opacity-80">
              {activeSpeechRomanization ?? 'Choose a command first'}
            </span>
          </button>
        </div>

        <div className="min-w-0">
          <SuPronunciationJudge
            hasVoiceCoach={hasVoiceCoach}
            isConnecting={isConnecting}
            isRecording={isRecording}
            verdict={verdict}
            voiceError={voiceError}
            voiceStatus={voiceStatus}
          />
        </div>
      </section>
    </section>
  );
}

function formatInventoryList(items: InventoryItemId[]) {
  return items.map((itemId) => getInventoryItem(itemId).label).join(', ');
}
