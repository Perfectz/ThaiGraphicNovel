import { useEffect, useRef, useState } from 'react';
import { bestSpeech, readSpeechAssessment, speechLabel, speechPower, type SpeechAssessment } from './speechPower';
import './RealtimeAttack.css';

async function pcmAudio(blob: Blob) {
  const decoder = new AudioContext();
  try {
    const source = await decoder.decodeAudioData(await blob.arrayBuffer());
    if (source.duration < .25 || source.duration > 20.1) throw new Error('Please record between one and twenty seconds.');
    const offline = new OfflineAudioContext(1, Math.ceil(source.duration * 24000), 24000);
    const node = offline.createBufferSource(); node.buffer = source; node.connect(offline.destination); node.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    const bytes = new Uint8Array(samples.length * 2), view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  } finally { await decoder.close(); }
}
function coachingWav(base64: string) {
  const binary = atob(base64), buffer = new ArrayBuffer(44 + binary.length), view = new DataView(buffer);
  const str = (at: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + binary.length, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, binary.length, true);
  for (let i = 0; i < binary.length; i++) view.setUint8(44 + i, binary.charCodeAt(i));
  return new Blob([buffer], { type: 'audio/wav' });
}
type Props = { clip: string; blocked: boolean; turnKey: string; baseDamage: number;
  onBusy: (value: boolean) => void; onCommit: (value: SpeechAssessment) => void; };
export default function RealtimeAttack({ clip, blocked, turnKey, baseDamage, onBusy, onCommit }: Props) {
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SpeechAssessment | null>(null), [best, setBest] = useState<SpeechAssessment | null>(null);
  const [checkedClip, setCheckedClip] = useState(''), [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState(''), [coaching, setCoaching] = useState(''), [coachUrl, setCoachUrl] = useState('');
  const [question, setQuestion] = useState(false), [coachCount, setCoachCount] = useState(0);
  const controller = useRef<AbortController | null>(null), generation = useRef(0), committed = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null), urlRef = useRef('');
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null);
  const questionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const busyRef = useRef(false);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => () => {
    generation.current++; controller.current?.abort(); clearTimeout(questionTimer.current);
    stream.current?.getTracks().forEach(t => t.stop()); audio.current?.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);
  useEffect(() => { audio.current?.pause(); }, [blocked, clip]);
  async function request(mode: 'assess' | 'coach', questionBlob?: Blob) {
    if (busyRef.current || blocked || committed.current) return;
    busyRef.current = true; setBusy(true); audio.current?.pause();
    const version = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    const timer = setTimeout(() => abort.abort(), 55000);
    setMessage(mode === 'assess' ? 'Su is listening to your recorded attempt…' : 'Su is preparing a short explanation…');
    try {
      const encoded = mode === 'assess' ? await pcmAudio(await (await fetch(clip)).blob()) : questionBlob ? await pcmAudio(questionBlob) : undefined;
      const attemptId = crypto.randomUUID();
      const response = await fetch('/api/realtime/battle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
        body: JSON.stringify({ mode, phraseId: 'hello', attemptId, turnKey, audio: encoded, ...(mode === 'coach' ? { assessment: result } : {}) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Coaching unavailable. Your turn is safe.');
      if (version !== generation.current) return;
      if (mode === 'assess') {
        const assessment = readSpeechAssessment(body.assessment);
        if (!assessment || assessment.attemptId !== attemptId || assessment.turnKey !== turnKey) throw new Error('This assessment does not match your turn. Please retry.');
        setResult(assessment); setCheckedClip(clip); setBest(previous => bestSpeech(previous, assessment));
        if (assessment.assessable) setAttempts(n => n + 1);
        setMessage(assessment.assessable ? 'Your turn is waiting. Use this power or record your coached retry.' : 'No grade this time. Record again or use an ungraded reply.');
      } else {
        if (typeof body.audio !== 'string' || typeof body.transcript !== 'string') throw new Error('No usable coaching returned.');
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(coachingWav(body.audio)); setCoachUrl(urlRef.current);
        setCoaching(body.transcript); setCoachCount(n => n + 1);
        setMessage('Listen to Su, then record your phrase again above.');
        const player = new Audio(urlRef.current); audio.current = player;
        void player.play().catch(() => setMessage('Tap Hear Su’s coaching to play the explanation.'));
      }
    } catch (error) {
      if (version === generation.current) setMessage(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Coaching timed out. Retry or use an ungraded reply; no turn was spent.');
    } finally {
      clearTimeout(timer);
      if (version === generation.current) { busyRef.current = false; setBusy(false); }
    }
  }
  async function askQuestion() {
    if (question) { recorder.current?.stop(); return; }
    if (busyRef.current || blocked || !result) return;
    busyRef.current = true; setBusy(true); audio.current?.pause();
    const version = ++generation.current;
    questionTimer.current = setTimeout(() => {
      if (generation.current !== version) return;
      generation.current++; busyRef.current = false; setBusy(false); setMessage('Microphone permission is still pending. You can keep playing.');
    }, 12000);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (version !== generation.current) { mic.getTracks().forEach(t => t.stop()); return; }
      clearTimeout(questionTimer.current); stream.current = mic;
      const rec = new MediaRecorder(mic), parts: BlobPart[] = []; recorder.current = rec;
      rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
      rec.onstop = () => {
        clearTimeout(questionTimer.current); mic.getTracks().forEach(t => t.stop());
        if (version !== generation.current) return;
        setQuestion(false); busyRef.current = false; setBusy(false);
        void request('coach', new Blob(parts, { type: rec.mimeType }));
      };
      rec.start(); setQuestion(true); setMessage('Ask Su about this phrase in English. Tap Finish question when ready.');
      questionTimer.current = setTimeout(() => rec.stop(), 15000);
    } catch {
      clearTimeout(questionTimer.current); if (version !== generation.current) return;
      busyRef.current = false; setBusy(false); setMessage('Microphone unavailable. You can still use the written coaching.');
    }
  }
  return <section className="speech-power" aria-label="Pronunciation power">
    <button className="speech-power-toggle" aria-expanded={enabled} disabled={blocked || busy}
      onClick={() => { audio.current?.pause(); setEnabled(v => !v); }}>✦ {enabled ? 'Pronunciation power enabled' : 'Enable pronunciation power'} <small>First Light · GPT Realtime</small></button>
    {enabled && <>
      <p>Record above, then let Su assess it. Clearer Thai powers a stronger attack. Two graded attempts; keep your best.</p>
      <small className="speech-experimental">Experimental AI estimate · 70–140% power · Thai-speaker calibration pending. Audio is sent to OpenAI only when you ask for assessment or coaching.</small>
      <button disabled={blocked || busy || !clip || clip === checkedClip || attempts >= 2} onClick={() => void request('assess')}>Assess my pronunciation</button>
      {result && <div className="speech-verdict" role="status">
        <strong>{result.band ? speechLabel[result.band] : 'Could not assess reliably'}</strong>
        <p>{result.feedback}</p>
        {result.focus && <p><b>Practise:</b> {result.focus}</p>}
        {result.correction && <p>{result.correction}</p>}
      </div>}
      {best?.band && <div className="speech-power-preview"><span>BEST ATTEMPT · {attempts}/2</span><strong>{Math.round(baseDamage * speechPower[best.band])} damage <small>{Math.round(speechPower[best.band] * 100)}% power</small></strong></div>}
      {result && <div className="speech-coach-actions">
        <button disabled={blocked || busy || coachCount >= 3} onClick={() => void request('coach')}>Coach me, Su</button>
        <button disabled={blocked || (busy && !question) || coachCount >= 3} onClick={() => void askQuestion()}>{question ? 'Finish question' : 'Ask Su a question'}</button>
      </div>}
      {coachUrl && <button disabled={blocked || busy} onClick={() => { audio.current?.pause(); audio.current = new Audio(coachUrl); void audio.current.play().catch(() => setMessage('Tap again to allow audio playback.')); }}>Hear Su’s coaching</button>}
      {coaching && <p className="speech-coaching">{coaching}</p>}
      <p role="status">{message || 'Your recording will be assessed before any damage is dealt.'}</p>
      {best?.band && <button className="speech-commit" disabled={blocked || busy} onClick={() => {
        if (committed.current) return; committed.current = true; audio.current?.pause(); onCommit(best);
      }}>Use assessed attack · {Math.round(baseDamage * speechPower[best.band])} damage</button>}
      <small>Using the normal reply below deals base damage without a pronunciation grade.</small>
    </>}
  </section>;
}
