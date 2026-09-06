import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer } from '../src/services/MusicPlayer.ts';
import { reservePracticeAudio, musicHasFocus, subscribeMusicFocus } from '../src/services/musicFocus.ts';
import { adventureScore } from '../src/bangkok/adventureScore.ts';
class AudioStub {
  src = ''; currentTime = 0; volume = 0; loop = false; paused = true; plays = 0;
  pending?: { resolve: () => void; reject: () => void };
  wait = false;
  play() { this.plays++; this.paused = false; return this.wait ? new Promise<void>((resolve, reject) => { this.pending = { resolve, reject: () => reject(new Error('blocked')) }; }) : Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
}
function fixture(wait = false) {
  const audio: AudioStub[] = [];
  const player = new MusicPlayer(() => { const a = new AudioStub(); a.wait = wait; audio.push(a); return a; });
  return { player, audio };
}
async function tick(player: MusicPlayer, count = 20) { for (let i = 0; i < count; i++) { player.tick(.1); await Promise.resolve(); } }
test('music requires a gesture, fades in, and pauses without losing playback time', async () => {
  const { player, audio } = fixture(); player.configure('hotel', true, .4, false); await tick(player); assert.equal(audio.length, 0);
  player.unlock(); await tick(player); assert.equal(audio.length, 1); assert.equal(audio[0].volume, .4); assert.equal(audio[0].plays, 1);
  audio[0].currentTime = 17; player.configure('hotel', true, .4, true); assert(audio[0].paused); assert.equal(audio[0].volume, 0);
  player.configure('hotel', true, .4, false); await tick(player); assert.equal(audio[0].currentTime, 17); assert(!audio[0].paused);
  player.configure('hotel', false, .4, false); assert(audio[0].paused); player.dispose();
});
test('border chatter does not restart music; a settled change crossfades and remembers the old track', async () => {
  const { player, audio } = fixture(); player.configure('hotel', true, .4, false); player.unlock(); await tick(player); audio[0].currentTime = 23;
  player.configure('street', true, .4, false); await tick(player, 3); player.configure('hotel', true, .4, false); await tick(player, 3); assert.equal(audio.length, 1);
  player.configure('street', true, .4, false); await tick(player, 10);
  assert.equal(audio.length, 2); assert(audio[0].volume > 0 && audio[1].volume > 0); assert(Math.abs(audio[0].volume + audio[1].volume - .4) < .001);
  await tick(player); assert(audio[0].paused); assert.equal(audio[0].src, '');
  player.configure('hotel', true, .4, false); await tick(player); assert.equal(audio[2].currentTime, 23); player.dispose();
});
test('a loading or rejected replacement leaves the previous track audible and can retry on gesture', async () => {
  const { player, audio } = fixture(true); player.configure('hotel', true, .3, false); player.unlock(); audio[0].pending!.resolve(); await tick(player);
  player.configure('market', true, .3, false); await tick(player); assert.equal(audio[0].volume, .3); assert.equal(audio[1].volume, 0);
  audio[1].pending!.reject(); await Promise.resolve(); await Promise.resolve(); await tick(player); assert.equal(audio[1].plays, 1);
  player.unlock(); assert.equal(audio[1].plays, 2); audio[1].pending!.resolve(); await tick(player); assert(audio[0].paused); player.dispose();
});
test('rapid changes keep only two sources and disposal defeats a late play promise', async () => {
  const { player, audio } = fixture(true); player.configure('hotel', true, .3, false); player.unlock(); audio[0].pending!.resolve(); await tick(player);
  player.configure('street', true, .3, false); await tick(player); player.configure('market', true, .3, false); await tick(player);
  assert.equal(audio.filter(a => a.src).length, 2); assert(audio[1].paused);
  player.dispose(); audio[1].pending!.resolve(); audio[2].pending!.resolve(); await Promise.resolve();
  assert(audio.every(a => a.paused && !a.src && a.volume === 0));
});
test('nested practice surfaces cannot resume the soundtrack until all release it', () => {
  let changes = 0; const unsubscribe = subscribeMusicFocus(() => changes++);
  const first = reservePracticeAudio(), second = reservePracticeAudio(); assert(!musicHasFocus());
  first(); first(); assert(!musicHasFocus()); second(); assert(musicHasFocus()); assert.equal(changes, 4); unsubscribe();
});
test('district themes distinguish travel, battle and menus, while roads keep the preceding theme', () => {
  assert.equal(adventureScore('hotel', 'world'), 'hotel'); assert.equal(adventureScore('sukhumvit', 'world'), 'street');
  assert.equal(adventureScore('yaowarat', 'world'), 'market'); assert.equal(adventureScore('oldtown', 'world'), 'journey');
  assert.equal(adventureScore('hotel', 'battle'), 'market'); assert.equal(adventureScore('hotel', 'title'), 'journey');
  assert.equal(adventureScore(null, 'world'), null);
});
