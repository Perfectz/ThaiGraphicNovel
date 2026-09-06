import { lazy, Suspense, useState } from 'react';
import BangkokAdventure from './BangkokAdventure';
const Training = lazy(() => import('./BangkokGame'));
export default function BangkokExperience() {
  const [training, setTraining] = useState(/\/training\/?$/.test(location.pathname));
  return training ? (
    <>
      <Suspense fallback={<p>Preparing camp…</p>}>
        <Training />
      </Suspense>
      <button className="rpg-training-return" onClick={() => setTraining(false)}>
        ← Return to the adventure
      </button>
    </>
  ) : (
    <BangkokAdventure onTrain={() => setTraining(true)} />
  );
}
