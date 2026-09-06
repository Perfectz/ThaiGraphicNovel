import { useEffect, useRef } from 'react';
import type { Battle } from './expeditionCombat';
import { BattleAudio } from './BattleAudio';
import { battleCue } from './battleCues';
import { musicHasFocus, subscribeMusicFocus } from '../services/musicFocus';

export function useBattleAudio(battle: Battle, enabled: boolean) {
  const engine = useRef<BattleAudio | null>(null);
  const preference = useRef(enabled);
  preference.current = enabled;
  const previous = useRef(battle);
  useEffect(() => {
    const audio = new BattleAudio();
    engine.current = audio;
    const configure = () => audio.setAllowed(preference.current && !document.hidden && musicHasFocus());
    const unlock = () => {
      configure();
      audio.unlock();
    };
    const release = subscribeMusicFocus(configure);
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', configure);
    configure();
    return () => {
      release();
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      document.removeEventListener('visibilitychange', configure);
      audio.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.setAllowed(enabled && !document.hidden && musicHasFocus());
  }, [enabled]);
  useEffect(() => {
    const cue = battleCue(previous.current, battle);
    previous.current = battle;
    if (!cue) return;
    engine.current?.setAllowed(preference.current && !document.hidden && musicHasFocus());
    const played = engine.current?.play(cue) ?? false;
    if (import.meta.env.DEV)
      window.dispatchEvent(
        new CustomEvent('bangkok-battle-cue', { detail: { cue, played, seq: battle.event.seq } }),
      );
  }, [battle]);
}
