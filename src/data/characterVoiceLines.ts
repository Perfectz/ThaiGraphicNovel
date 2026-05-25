import { getStageIntroLines } from './adventures/stageIntros';
import { stageTwoAdventure } from './adventures/stage02-front-desk';
import { stageThreeAdventure } from './adventures/stage03-night-market';
import type { AdventureSceneConfig } from './adventures/types';
import {
  getCommandCharacterVoiceAudioId,
  getConversationTurnCharacterVoiceAudioId,
  getStageIntroCharacterVoiceAudioId,
} from './characterVoiceIds';

export type OpenAiVoiceName =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'marin'
  | 'cedar';

export type CharacterVoiceLine = {
  id: string;
  speaker: string;
  text: string;
  category: 'intro' | 'conversation' | 'response';
  note: string;
  voice: OpenAiVoiceName;
  model: 'gpt-realtime-2';
};

const characterVoiceModel = 'gpt-realtime-2' as const;

const voiceBySpeaker: Record<string, OpenAiVoiceName> = {
  Su: 'coral',
  Patrick: 'cedar',
  Hostess: 'marin',
  Bellhop: 'cedar',
  'Street Food Vendor': 'shimmer',
  'Wok Chef': 'echo',
};

const stageConfigs = [
  stageTwoAdventure,
  stageThreeAdventure,
] as const satisfies readonly AdventureSceneConfig[];

function line(
  id: string,
  speaker: string,
  category: CharacterVoiceLine['category'],
  note: string,
  text: string,
): CharacterVoiceLine {
  return {
    id,
    speaker,
    category,
    note,
    text,
    voice: voiceBySpeaker[speaker] ?? 'alloy',
    model: characterVoiceModel,
  };
}

function collectIntroLines(config: AdventureSceneConfig): CharacterVoiceLine[] {
  return getStageIntroLines(config.scenarioId).map((introLine) =>
    line(
      getStageIntroCharacterVoiceAudioId(config.scenarioId, introLine.id, introLine.speaker),
      introLine.speaker,
      'intro',
      `Stage ${config.scenarioNumber} intro ${introLine.id}`,
      introLine.text,
    ),
  );
}

function collectConversationLines(config: AdventureSceneConfig): CharacterVoiceLine[] {
  return config.rooms.flatMap((room) =>
    room.hotspots.flatMap((hotspot) =>
      Object.values(hotspot.commands).flatMap((command) => {
        if (!command?.conversationId || !command.conversation?.length) return [];
        return command.conversation.map((turn) =>
          line(
            getConversationTurnCharacterVoiceAudioId(
              config.scenarioId,
              command.conversationId!,
              turn.id,
              turn.npcSpeaker,
            ),
            turn.npcSpeaker,
            'conversation',
            `Stage ${config.scenarioNumber} ${turn.npcSpeaker} conversation ${turn.id}`,
            turn.npcLineThai,
          ),
        );
      }),
    ),
  );
}

function collectCommandResponseLines(config: AdventureSceneConfig): CharacterVoiceLine[] {
  return config.rooms.flatMap((room) =>
    room.hotspots.flatMap((hotspot) =>
      Object.values(hotspot.commands).flatMap((command) => {
        if (!command?.characterVoice) return [];
        return line(
          getCommandCharacterVoiceAudioId(
            config.scenarioId,
            hotspot.id,
            command.verb,
            command.characterVoice.speaker,
          ),
          command.characterVoice.speaker,
          'response',
          `Stage ${config.scenarioNumber} ${hotspot.id} ${command.verb} response`,
          command.characterVoice.text,
        );
      }),
    ),
  );
}

export const characterVoiceLines: CharacterVoiceLine[] = stageConfigs.flatMap((config) => [
  ...collectIntroLines(config),
  ...collectConversationLines(config),
  ...collectCommandResponseLines(config),
]);
