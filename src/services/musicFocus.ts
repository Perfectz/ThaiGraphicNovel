const owners = new Set<symbol>();
const listeners = new Set<() => void>();
export const musicHasFocus = () => owners.size === 0;
export function subscribeMusicFocus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function reservePracticeAudio() {
  const owner = Symbol('Thai practice');
  owners.add(owner);
  listeners.forEach((listener) => listener());
  return () => {
    if (!owners.delete(owner)) return;
    listeners.forEach((listener) => listener());
  };
}
