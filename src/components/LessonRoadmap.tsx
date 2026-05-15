import { lessonScenarios } from '../data/lessonScenarios';
import { getPhrasePhoneticSpelling } from '../data/thaiPhrases';

type LessonRoadmapProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function LessonRoadmap({ isOpen, onClose }: LessonRoadmapProps) {
  if (!isOpen) return null;

  return (
    <section className="pointer-events-auto fixed inset-0 z-50 bg-slate-950/70 p-3 text-slate-950 backdrop-blur-sm sm:p-5">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-3xl border-4 border-slate-950 bg-amber-50 shadow-rpg">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-slate-950 bg-amber-300 px-4 py-3 sm:px-5">
          <div>
            <p className="font-display text-xs font-black uppercase tracking-[0.18em] text-amber-950">Thai Quest Roadmap</p>
            <h2 className="text-2xl font-black text-slate-950 sm:text-3xl">10 escalating scenario lessons</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border-[3px] border-slate-950 bg-white px-4 py-2 text-sm font-black uppercase tracking-[0.14em] text-slate-950 shadow-md active:translate-y-1"
          >
            Close
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {lessonScenarios.map((scenario) => (
              <article key={scenario.id} className="rounded-2xl border-[3px] border-slate-950 bg-white p-4 shadow-md">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xs font-black uppercase tracking-[0.16em] text-red-700">
                      Scenario {scenario.scenarioNumber} - {scenario.difficulty}
                    </p>
                    <h3 className="text-xl font-black leading-tight text-slate-950">{scenario.title}</h3>
                    <p className="text-sm font-black text-slate-700">{scenario.location}</p>
                  </div>
                  <div className="rounded-xl border-2 border-slate-950 bg-cyan-100 px-3 py-2 text-right text-xs font-black text-cyan-950">
                    <p>{scenario.equipmentReward.slot}</p>
                    <p>{scenario.equipmentReward.name}</p>
                  </div>
                </div>

                <p className="mb-2 text-sm font-bold leading-snug text-slate-800">{scenario.storyGoal}</p>
                <p className="mb-3 text-sm font-black leading-snug text-emerald-800">{scenario.lessonGoal}</p>

                <div className="mb-3 rounded-2xl border-2 border-fuchsia-950 bg-fuchsia-50 px-3 py-2 text-sm">
                  <p className="font-black text-fuchsia-950">{scenario.superMove.name}</p>
                  <p className="font-bold text-slate-700">{scenario.superMove.effect}</p>
                </div>

                <div className="grid gap-2">
                  {scenario.chunks.map((chunk, index) => (
                    <section key={chunk.id} className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-sm font-black text-slate-950">
                          Chunk {index + 1}: {chunk.title}
                        </h4>
                        <span className="rounded-full bg-emerald-200 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-950">
                          {chunk.focus}
                        </span>
                      </div>
                      <p className="mb-2 text-xs font-bold leading-snug text-slate-700">{chunk.objective}</p>
                      <div className="grid gap-1">
                        {chunk.phrases.map((phrase) => (
                          <div key={phrase.id} className="grid gap-1 rounded-xl bg-white px-3 py-2 text-sm sm:grid-cols-[1fr_1fr]">
                            <p className="font-black text-slate-950">{phrase.targetPhrase}</p>
                            <div>
                              <p className="font-bold text-slate-700">{phrase.romanization} - {phrase.translation}</p>
                              <p className="text-xs font-black text-emerald-800">Phonetic: {getPhrasePhoneticSpelling(phrase)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
