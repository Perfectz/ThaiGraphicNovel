import { useEffect, useRef } from 'react';
import {
  createBattleStage3D,
  type BattleStageController,
  type BattleStageOptions,
  type BattleVfxRequest,
} from './three/battleStageScene';

export type BattleStage3DProps = {
  heroCasting: boolean;
  heroHurt: boolean;
  heroDown: boolean;
  heroVictory: boolean;
  suCasting: boolean;
  suDown: boolean;
  enemyHurt: boolean;
  enemyCasting: boolean;
  enemyDown: boolean;
  /** Active VFX bursts from the battle reducer; new ids fire a 3D burst once. */
  vfx: BattleVfxRequest[];
  /** Toggles true on every screen-shake event from the reducer. */
  hasShake: boolean;
  /** Per-encounter opponent model / ally visibility (social duels). */
  stageOptions?: BattleStageOptions;
};

/**
 * Mounts the Three.js battle stage and pushes battle-reducer state into it.
 * The heavy lifting (scene, rigs, render loop) lives in battleStageScene; this
 * component only diffs props into imperative controller calls.
 */
export function BattleStage3D(props: BattleStage3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<BattleStageController | null>(null);
  const seenVfxRef = useRef<Set<number>>(new Set());
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let controller: BattleStageController | null = null;

    void createBattleStage3D(mount, propsRef.current.stageOptions ?? {})
      .then((created) => {
        if (cancelled) {
          created.dispose();
          return;
        }
        controller = created;
        controllerRef.current = created;
        const current = propsRef.current;
        // Don't replay bursts that were already active before the scene mounted.
        current.vfx.forEach((v) => seenVfxRef.current.add(v.id));
        created.setHero({
          casting: current.heroCasting,
          hurt: current.heroHurt,
          down: current.heroDown,
          victory: current.heroVictory,
        });
        created.setSu({ casting: current.suCasting, down: current.suDown });
        created.setEnemy({
          hurt: current.enemyHurt,
          casting: current.enemyCasting,
          down: current.enemyDown,
        });
      })
      .catch(() => {
        /* Scene init failure leaves an empty mount; the HUD still works. */
      });

    const onResize = () => controllerRef.current?.resize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      controller?.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setHero({
      casting: props.heroCasting,
      hurt: props.heroHurt,
      down: props.heroDown,
      victory: props.heroVictory,
    });
  }, [props.heroCasting, props.heroHurt, props.heroDown, props.heroVictory]);

  useEffect(() => {
    controllerRef.current?.setSu({ casting: props.suCasting, down: props.suDown });
  }, [props.suCasting, props.suDown]);

  useEffect(() => {
    controllerRef.current?.setEnemy({
      hurt: props.enemyHurt,
      casting: props.enemyCasting,
      down: props.enemyDown,
    });
  }, [props.enemyHurt, props.enemyCasting, props.enemyDown]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    for (const request of props.vfx) {
      if (seenVfxRef.current.has(request.id)) continue;
      seenVfxRef.current.add(request.id);
      controller.spawnVfx(request);
    }
  }, [props.vfx]);

  useEffect(() => {
    if (props.hasShake) controllerRef.current?.shake(0.5);
  }, [props.hasShake]);

  return <div ref={mountRef} className="absolute inset-0 z-0" data-testid="battle-stage-3d" />;
}

export default BattleStage3D;
