import * as THREE from 'three';

/**
 * In-world "cinema" screen for the VR pre-roll.
 *
 * A flat-screen <video> overlay is invisible inside an immersive WebXR session,
 * but the element still decodes frames and plays its audio while hidden. This
 * module wraps that live element in a THREE.VideoTexture and maps it onto a
 * large screen floating in front of the player, with a dark backdrop so the
 * room dims to "theater black" behind it. Visibility is toggled by the caller
 * for the duration of the intro.
 *
 * The screen is parented to the player rig (by the caller) so it stays docked
 * in front of the player even as they look around.
 */

export type XRCinemaHandle = {
  group: THREE.Group;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
};

export function createXRCinema(video: HTMLVideoElement): XRCinemaHandle {
  const group = new THREE.Group();
  group.name = 'xr-cinema';

  // Theater backdrop — a large inward-facing sphere that dims the room. Drawn
  // first (renderOrder -1) and with depthWrite off so the screen in front of it
  // always composites cleanly on top.
  const backdrop = new THREE.Mesh(
    new THREE.SphereGeometry(14, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0x04060a,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  backdrop.name = 'xr-cinema-backdrop';
  backdrop.renderOrder = -1;
  group.add(backdrop);

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const screenWidth = 2.9;
  const screenHeight = (screenWidth * 9) / 16;
  const screenZ = -3.1;
  const screenY = 1.55;

  // Bezel just behind the picture so the frame reads as a real screen, not a
  // floating rectangle.
  const bezel = new THREE.Mesh(
    new THREE.PlaneGeometry(screenWidth + 0.14, screenHeight + 0.14),
    new THREE.MeshBasicMaterial({ color: 0x0b0f15 }),
  );
  bezel.position.set(0, screenY, screenZ - 0.02);
  bezel.name = 'xr-cinema-bezel';
  group.add(bezel);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenWidth, screenHeight),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  screen.position.set(0, screenY, screenZ);
  screen.renderOrder = 1;
  screen.name = 'xr-cinema-screen';
  group.add(screen);

  group.visible = false;

  function setVisible(visible: boolean) {
    group.visible = visible;
  }

  function dispose() {
    screen.geometry.dispose();
    (screen.material as THREE.Material).dispose();
    bezel.geometry.dispose();
    (bezel.material as THREE.Material).dispose();
    backdrop.geometry.dispose();
    (backdrop.material as THREE.Material).dispose();
    texture.dispose();
  }

  return { group, setVisible, dispose };
}
