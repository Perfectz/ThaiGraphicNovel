import { useEffect, useRef, useState } from 'react';
import { Scene3DEngine } from '../scenes/Scene3DEngine';
import { TitleSceneEngine } from '../scenes/TitleSceneEngine';

/**
 * Thin React adapter for {@link TitleSceneEngine}. All Three.js state lives in
 * the engine class — this component just instantiates it, attaches it to a DOM
 * node, and disposes on unmount.
 *
 * Renders nothing on devices without WebGL or when the engine throws during
 * construction; the surrounding title screen still works without the 3D
 * background.
 */
export function TitleThreeScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [unsupported, setUnsupported] = useState(() => !Scene3DEngine.isWebGLAvailable());

  useEffect(() => {
    if (unsupported) return;
    const mount = mountRef.current;
    if (!mount) return;

    let engine: TitleSceneEngine | null = null;
    try {
      engine = new TitleSceneEngine();
      engine.attach(mount);
    } catch (error) {
      console.warn('[TitleThreeScene] WebGL engine failed to start', error);
      engine?.dispose();
      setUnsupported(true);
      return;
    }

    return () => {
      engine?.dispose();
    };
  }, [unsupported]);

  if (unsupported) return null;
  return <div ref={mountRef} className="title-three-scene absolute inset-0" aria-hidden="true" />;
}
