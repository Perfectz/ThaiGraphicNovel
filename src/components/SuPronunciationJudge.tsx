import suPronunciationReactionsUrl from '../assets/portraits/su-pronunciation-reactions.png';
import { type PronunciationVerdict } from '../services/realtimePronunciation';
import type { VoiceJudgeMode } from '../services/openAiSettings';
import { Card, VerdictBadge, type VerdictTone } from './ui';

const PORTRAIT_COLUMNS = 5;

/**
 * Four canonical verdict tones replace the previous ten-Tailwind-color sprawl.
 * Each maps to one semantic meaning and one portrait frame; card chrome stays
 * constant, only a 3px left rule (rendered by `Card tone=…`) carries the
 * tone signal. See plan §2.2.
 */
type SuReactionTone = 'success' | 'pass' | 'coaching' | 'error';

type SuReaction = {
  tone: SuReactionTone;
  /** Index into the 5-column x 2-row reaction sprite sheet. */
  portraitIndex: number;
  title: string;
  line: string;
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
  /**
   * Number of times the player tapped Skip Phrase during this stage.
   * Surfaced as a small line under the verdict so players who relied on
   * Skip (mic issues, accessibility) know the system noticed, and so
   * Q3's SRS layer can later treat skipped phrases as "needs review".
   */
  skipCount?: number;
  /**
   * Active voice judge mode. Used to tailor the "Ready when you are"
   * default panel — no-mic players shouldn't be told to connect a mic.
   */
  voiceMode?: VoiceJudgeMode;
};

function getSuReaction({
  hasVoiceCoach,
  isConnecting,
  isRecording,
  verdict,
  voiceError,
  voiceStatus,
  stageComplete,
  voiceMode,
}: SuPronunciationJudgeProps): SuReaction {
  if (voiceError) {
    return {
      tone: 'error',
      portraitIndex: 8,
      title: 'Mic stumbled',
      line: 'Check the connection, then try again slowly.',
    };
  }

  if (isConnecting || voiceStatus.toLowerCase().includes('judging')) {
    return {
      tone: 'coaching',
      portraitIndex: 2,
      title: isConnecting ? 'Tuning the rift' : 'Comparing what I heard',
      line: 'Hold still.',
    };
  }

  if (isRecording) {
    return {
      tone: 'coaching',
      portraitIndex: 1,
      title: 'Listening',
      line: 'Speak naturally — tones, rhythm, and ending sound.',
    };
  }

  if (stageComplete) {
    return {
      tone: 'success',
      portraitIndex: 3,
      title: 'Stage report ready',
      line: 'Score notes and the next practice focus are below.',
    };
  }

  if (voiceMode === 'no-mic') {
    return {
      tone: 'coaching',
      portraitIndex: 0,
      title: 'Read & tap',
      line: 'No mic this run. Read each phrase aloud (optional), then tap Confirm to continue.',
    };
  }

  if (!hasVoiceCoach) {
    return {
      tone: 'coaching',
      portraitIndex: 0,
      title: 'Ready when you are',
      line: 'Connect the AI mic and I will guide each phrase.',
    };
  }

  if (!verdict) {
    return {
      tone: 'coaching',
      portraitIndex: 0,
      title: 'Coaching',
      line: 'Hold the mic and say the phrase with confidence.',
    };
  }

  if (verdict.score >= 85 || (verdict.pass && verdict.score >= 75)) {
    return {
      tone: 'success',
      portraitIndex: 3,
      title: verdict.score >= 95 ? 'Excellent' : 'Strong',
      line: verdict.score >= 95 ? 'Tone and rhythm landed clearly.' : 'Clean shape. Polish the ending sound.',
    };
  }

  if (verdict.pass) {
    return {
      tone: 'pass',
      portraitIndex: 5,
      title: 'Passed',
      line: 'The meaning came through.',
    };
  }

  if (verdict.score >= 35) {
    return {
      tone: 'coaching',
      portraitIndex: 7,
      title: 'Almost — slow it down',
      line: verdict.tip || 'Match the syllable rhythm before trying again.',
    };
  }

  return {
    tone: 'error',
    portraitIndex: 8,
    title: 'Try again',
    line: verdict.tip || 'Listen to the guide phrase, then say it slower.',
  };
}

const CARD_TONE: Record<SuReactionTone, 'jade' | 'coach' | 'ember' | 'none'> = {
  success: 'jade',
  pass: 'none',
  coaching: 'coach',
  error: 'ember',
};

const VERDICT_TONE: Record<SuReactionTone, VerdictTone> = {
  success: 'jade',
  pass: 'paper',
  coaching: 'coach',
  error: 'ember',
};

function getPortraitPosition(index: number) {
  const column = index % PORTRAIT_COLUMNS;
  const row = Math.floor(index / PORTRAIT_COLUMNS);
  return `${column * 25}% ${row * 100}%`;
}

export function SuPronunciationJudge(props: SuPronunciationJudgeProps) {
  const reaction = getSuReaction(props);
  const detailLine = props.stageComplete ? '' : props.voiceError || props.voiceStatus;
  const report = props.stageReport ?? [];
  const skipCount = props.skipCount ?? 0;
  const portraitStyle = {
    backgroundImage: `url(${suPronunciationReactionsUrl})`,
    backgroundPosition: getPortraitPosition(reaction.portraitIndex),
    backgroundSize: '500% 200%',
  };

  return (
    <Card tone={CARD_TONE[reaction.tone]} className="p-3">
      <div className="grid grid-cols-[4.5rem_1fr] items-start gap-3 sm:grid-cols-[5.25rem_1fr]">
        <div
          className="relative aspect-square overflow-hidden rounded-md border border-hairline bg-ink-elevated"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-cover bg-no-repeat" style={portraitStyle} />
        </div>
        <div className="min-w-0">
          <VerdictBadge tone={VERDICT_TONE[reaction.tone]} label={reaction.title} />
          <p className="mt-2 text-sm font-medium leading-relaxed text-paper">{reaction.line}</p>
          {detailLine ? (
            <p className="mt-1 text-xs font-medium leading-relaxed text-paper-muted">{detailLine}</p>
          ) : null}

          {props.verdict ? (
            <dl className="mt-3 grid gap-1.5 text-xs leading-relaxed">
              <div className="grid grid-cols-[5rem_1fr] gap-2">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-paper-muted">
                  Score
                </dt>
                <dd className="font-semibold text-paper">
                  {props.verdict.score}/100 — {props.verdict.pass ? 'Passed' : 'Needs practice'}
                </dd>
              </div>
              {props.verdict.heard ? (
                <div className="grid grid-cols-[5rem_1fr] gap-2">
                  <dt className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-paper-muted">
                    Heard
                  </dt>
                  <dd className="min-w-0 break-words font-medium text-paper">{props.verdict.heard}</dd>
                </div>
              ) : null}
              <div className="grid grid-cols-[5rem_1fr] gap-2">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-paper-muted">
                  Feedback
                </dt>
                <dd className="min-w-0 break-words font-medium text-paper-muted">{props.verdict.feedback}</dd>
              </div>
              <div className="grid grid-cols-[5rem_1fr] gap-2">
                <dt className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-paper-muted">Tip</dt>
                <dd className="min-w-0 break-words font-medium text-paper-muted">{props.verdict.tip}</dd>
              </div>
            </dl>
          ) : null}

          {skipCount > 0 ? (
            <p className="mt-2 text-[0.7rem] font-medium leading-relaxed text-paper-muted">
              Skipped {skipCount} phrase{skipCount === 1 ? '' : 's'} this stage — they'll be flagged for
              review.
            </p>
          ) : null}

          {props.stageComplete && report.length > 0 ? (
            <div className="mt-3 border-t border-hairline pt-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-paper-muted">
                End-of-stage report
              </p>
              <ul className="mt-2 grid gap-1.5 text-xs font-medium leading-relaxed text-paper">
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
    </Card>
  );
}
