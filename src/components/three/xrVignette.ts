import * as THREE from 'three';

/**
 * Comfort vignette — peripheral-occlusion tunnel for VR locomotion.
 *
 * The single highest comfort-per-line change in the XR layer. Artificial
 * movement and turning trigger nausea because the periphery streams optical
 * flow the vestibular system can't reconcile. Darkening that periphery while
 * the player moves removes most of the conflict.
 *
 * Implementation: a head-locked inward-facing ring drawn as a fixed overlay in
 * front of both eyes. It is parented to the XR camera by the caller, rendered
 * last with depth test/write OFF so it composites over the world regardless of
 * scene depth, and never writes to the depth buffer. A radial alpha falloff
 * keeps the centre fully clear (you can always see where you're going) while
 * the edges close in proportional to `setAmount`.
 *
 * `setAmount(0)` is fully open (invisible); `setAmount(1)` is a tight tunnel.
 * The caller lerps the amount from per-frame locomotion speed × comfort level.
 */

export type XRVignetteHandle = {
  group: THREE.Group;
  /** 0 = open/invisible, 1 = tight tunnel. Cheap; safe to call every frame. */
  setAmount: (amount: number) => void;
  dispose: () => void;
};

// A ring sized to blanket the periphery of a head-locked quad ~1m in front of
// the eyes. Inner radius stays clear; outer radius runs past the FOV edge.
const INNER_RADIUS = 0.34;
const OUTER_RADIUS = 1.5;
const DISTANCE = 1.0;

const VIGNETTE_COLOR = new THREE.Color(0x000000);

export function createXRVignette(): XRVignetteHandle {
  const group = new THREE.Group();
  group.name = 'xr-vignette';

  const geometry = new THREE.RingGeometry(INNER_RADIUS, OUTER_RADIUS, 64, 1);

  // Per-vertex alpha: 0 at the inner edge (clear), 1 at the outer edge (opaque),
  // so the ring fades smoothly from the open centre into solid black periphery.
  const position = geometry.attributes.position;
  const alphas = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const r = Math.hypot(x, y);
    const t = (r - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS);
    alphas[i] = THREE.MathUtils.clamp(t, 0, 1);
  }
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  // A tiny ShaderMaterial: vertex passes the baked edge alpha, fragment scales
  // it by the uniform `uAmount` so the whole tunnel opens/closes in one cheap
  // uniform write — no geometry churn, no per-frame CPU work.
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uAmount: { value: 0 },
      uColor: { value: VIGNETTE_COLOR },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float a = vAlpha * uAmount;
        if (a <= 0.001) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'xr-vignette-ring';
  mesh.position.set(0, 0, -DISTANCE);
  // Render after everything else; combined with depthTest off this guarantees
  // the tunnel always sits on top of the world and both UI panels.
  mesh.renderOrder = 10_000;
  mesh.frustumCulled = false;
  group.add(mesh);

  let current = 0;

  function setAmount(amount: number) {
    const next = THREE.MathUtils.clamp(amount, 0, 1);
    if (next === current) return;
    current = next;
    material.uniforms.uAmount.value = next;
    // Hide the mesh entirely when fully open so it costs nothing to draw.
    mesh.visible = next > 0.001;
  }

  // Start fully open / hidden.
  mesh.visible = false;

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { group, setAmount, dispose };
}
