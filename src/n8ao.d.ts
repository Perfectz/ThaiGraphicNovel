// Ambient types for the `n8ao` package (ships JS only). Covers just the
// N8AOPass surface the cinematic pipeline uses.
declare module 'n8ao' {
  import type { Camera, Color, Scene } from 'three';
  import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

  export class N8AOPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: {
      aoRadius: number;
      distanceFalloff: number;
      intensity: number;
      color: Color;
      aoSamples: number;
      denoiseSamples: number;
      denoiseRadius: number;
      halfRes: boolean;
      screenSpaceRadius: boolean;
      gammaCorrection: boolean;
      [key: string]: unknown;
    };
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
    setDisplayMode(mode: 'Combined' | 'AO' | 'No AO' | 'Split' | 'Split AO'): void;
    setSize(width: number, height: number): void;
    dispose(): void;
  }

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
  }

  export const DepthType: Record<string, number>;
}
