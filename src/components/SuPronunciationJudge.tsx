import suPronunciationReactionsUrl from '../assets/portraits/su-pronunciation-reactions.png';
import { type PronunciationVerdict } from '../services/realtimePronunciation';

const PORTRAIT_COLUMNS = 5;

type SuReaction = {
  index: number;
  title: string;
  line: string;
  toneClass: string;
};

type SuPronunciationJudgeProps = {
  hasVoiceCoach: boolean;
  isConnecting: boolean;
  isRecording: boolean;
  verdict: PronunciationVerdict | null;
  voiceError: string;
  voiceStatus: string;
};

function getSuReaction({
  hasVoiceCoach,
  isConnecting,
  isRecording,
  verdict,
  voiceError,
  voiceStatus,
}: SuPronunciationJudgeProps): SuReaction {
  if (voiceError) {
    return {
      index: 8,
      title: 'Su is worried',
      line: 'The magic mic stumbled. Check the connection, then try again slowly.',
      toneClass: 'border-red-950 bg-red-50 text-red-950',
    };
  }

  if (isConnecting) {
    return {
      index: 2,
      title: 'Su is syncing',
      line: 'Hold still. I am tuning the rift so I can hear your Thai clearly.',
      toneClass: 'border-cyan-950 bg-cyan-50 text-cyan-950',
    };
  }

  if (isRecording) {
    return {
      index: 1,
      title: 'Su is listening',
      line: 'Speak naturally. I am listening for the rhythm, tones, and ending sound.',
      toneClass: 'border-sky-950 bg-sky-50 text-sky-950',
    };
  }

  if (voiceStatus.toLowerCase().includes('judging')) {
    return {
      index: 2,
      title: 'Su is judging',
      line: 'Give me one second. I am comparing what I heard against the phrase.',
      toneClass: 'border-indigo-950 bg-indigo-50 text-indigo-950',
    };
  }

  if (!hasVoiceCoach) {
    return {
      index: 0,
      title: 'Su is ready',
      line: 'Connect the AI mic and I will guide each Thai phrase in the trial.',
      toneClass: 'border-amber-950 bg-amber-50 text-amber-950',
    };
  }

  if (!verdict) {
    return {
      index: 0,
      title: 'Su is coaching',
      line: 'Ready for the next phrase. Hold the button, then say it with confidence.',
      toneClass: 'border-emerald-950 bg-emerald-50 text-emerald-950',
    };
  }

  if (verdict.score >= 95) {
    return {
      index: 3,
      title: 'Excellent',
      line: 'That was sharp. The tone and rhythm landed like real street magic.',
      toneClass: 'border-emerald-950 bg-emerald-50 text-emerald-950',
    };
  }

  if (verdict.score >= 85) {
    return {
      index: 4,
      title: 'Good attempt',
      line: 'Strong pronunciation. Keep that shape and push the ending sound a little cleaner.',
      toneClass: 'border-lime-950 bg-lime-50 text-lime-950',
    };
  }

  if (verdict.pass) {
    return {
      index: 5,
      title: 'Passed',
      line: 'Understandable. Not perfect yet, but the meaning came through clearly.',
      toneClass: 'border-yellow-950 bg-yellow-50 text-yellow-950',
    };
  }

  if (verdict.score >= 55) {
    return {
      index: 6,
      title: 'Correction',
      line: verdict.tip || 'Close. Slow down and copy the syllable rhythm before trying again.',
      toneClass: 'border-orange-950 bg-orange-50 text-orange-950',
    };
  }

  if (verdict.score >= 35) {
    return {
      index: 7,
      title: 'Su is confused',
      line: verdict.tip || 'I heard a different shape. Reset your mouth position and try the phrase again.',
      toneClass: 'border-purple-950 bg-purple-50 text-purple-950',
    };
  }

  return {
    index: 8,
    title: 'Try again',
    line: verdict.tip || 'That one missed. Breathe, listen to the guide phrase, and say it slower.',
    toneClass: 'border-red-950 bg-red-50 text-red-950',
  };
}

function getPortraitPosition(index: number) {
  const column = index % PORTRAIT_COLUMNS;
  const row = Math.floor(index / PORTRAIT_COLUMNS);
  return `${column * 25}% ${row * 100}%`;
}

export function SuPronunciationJudge(props: SuPronunciationJudgeProps) {
  const reaction = getSuReaction(props);
  const detailLine = props.voiceError || props.voiceStatus;
  const portraitStyle = {
    backgroundImage: `url(${suPronunciationReactionsUrl})`,
    backgroundPosition: getPortraitPosition(reaction.index),
    backgroundSize: '500% 200%',
  };

  return (
    <div className={`grid grid-cols-[5.25rem_1fr] items-center gap-3 rounded-2xl border-[3px] p-2 shadow-md sm:grid-cols-[6.25rem_1fr] ${reaction.toneClass}`}>
      <div className="relative aspect-square overflow-hidden rounded-xl border-[3px] border-slate-950 bg-slate-950">
        <div className="absolute inset-0 bg-cover bg-no-repeat" style={portraitStyle} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-xs font-black uppercase tracking-[0.16em] opacity-80">Su Judge</p>
        <p className="text-base font-black leading-tight sm:text-lg">{reaction.title}</p>
        <p className="mt-1 text-sm font-bold leading-snug">{reaction.line}</p>
        {detailLine ? <p className="mt-1 text-xs font-black leading-snug opacity-80">{detailLine}</p> : null}
      </div>
    </div>
  );
}
