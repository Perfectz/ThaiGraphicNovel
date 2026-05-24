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
  stageComplete?: boolean;
  stageReport?: string[];
};

function getSuReaction({
  hasVoiceCoach,
  isConnecting,
  isRecording,
  verdict,
  voiceError,
  voiceStatus,
  stageComplete,
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

  if (stageComplete) {
    return {
      index: 3,
      title: 'Stage report ready',
      line: 'Su wrote down your score notes and the practice focus for the next stage.',
      toneClass: 'border-emerald-950 bg-emerald-50 text-emerald-950',
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
      line: 'Su says that was sharp. The tone and rhythm landed clearly.',
      toneClass: 'border-emerald-950 bg-emerald-50 text-emerald-950',
    };
  }

  if (verdict.score >= 85) {
    return {
      index: 4,
      title: 'Good attempt',
      line: 'Su says that was strong. Keep that shape and clean up the ending sound.',
      toneClass: 'border-lime-950 bg-lime-50 text-lime-950',
    };
  }

  if (verdict.pass) {
    return {
      index: 5,
      title: 'Passed',
      line: 'Su says the meaning came through clearly enough to move on.',
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
  const detailLine = props.stageComplete ? '' : props.voiceError || props.voiceStatus;
  const report = props.stageReport ?? [];
  const portraitStyle = {
    backgroundImage: `url(${suPronunciationReactionsUrl})`,
    backgroundPosition: getPortraitPosition(reaction.index),
    backgroundSize: '500% 200%',
  };

  return (
    <div className={`grid grid-cols-[4.75rem_1fr] items-start gap-3 rounded-2xl border p-2 shadow-sm sm:grid-cols-[5.75rem_1fr] ${reaction.toneClass}`}>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-950/30 bg-slate-950">
        <div className="absolute inset-0 bg-cover bg-no-repeat" style={portraitStyle} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="font-display text-xs font-black uppercase tracking-[0.16em] opacity-80">Su Judge</p>
        <p className="text-base font-black leading-tight sm:text-lg">{reaction.title}</p>
        <p className="mt-1 text-sm font-bold leading-snug">{reaction.line}</p>
        {detailLine ? <p className="mt-1 text-xs font-black leading-snug opacity-80">{detailLine}</p> : null}
        {props.verdict ? (
          <div className="mt-2 grid gap-1.5 text-xs font-bold leading-snug">
            <div className="grid grid-cols-[5.75rem_1fr] gap-2">
              <span className="font-black uppercase tracking-[0.12em] opacity-70">Score</span>
              <span>
                {props.verdict.score}/100 - {props.verdict.pass ? 'Passed' : 'Needs practice'}
              </span>
            </div>
            {props.verdict.heard ? (
              <div className="grid grid-cols-[5.75rem_1fr] gap-2">
                <span className="font-black uppercase tracking-[0.12em] opacity-70">Heard</span>
                <span className="min-w-0 break-words">{props.verdict.heard}</span>
              </div>
            ) : null}
            <div className="grid grid-cols-[5.75rem_1fr] gap-2">
              <span className="font-black uppercase tracking-[0.12em] opacity-70">Su Feedback</span>
              <span className="min-w-0 break-words">{props.verdict.feedback}</span>
            </div>
            <div className="grid grid-cols-[5.75rem_1fr] gap-2">
              <span className="font-black uppercase tracking-[0.12em] opacity-70">Su Tip</span>
              <span className="min-w-0 break-words">{props.verdict.tip}</span>
            </div>
          </div>
        ) : null}
        {props.stageComplete && report.length > 0 ? (
          <div className="mt-2 border-t border-current/20 pt-2">
            <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] opacity-80">End of Stage Report</p>
            <ul className="mt-1 grid gap-1 text-xs font-bold leading-snug">
              {report.map((item) => (
                <li key={item} className="min-w-0 break-words">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
