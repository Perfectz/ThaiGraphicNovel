#!/usr/bin/env node
/**
 * Audio coverage report for Bangkok Rift.
 *
 * Cross-references the lesson data (lessonScenarios + stageOneConversationDeck +
 * stageTwoSuBriefing + stageIntros) against the actual audio files on disk in
 * src/assets/audio/su/. Prints per-stage coverage so we know which lines are
 * silent and need TTS or human recording before the demo ships.
 *
 * Usage: node scripts/audio-coverage.mjs
 *        npm run audio:coverage
 *
 * Exit code is always 0 — this is informational, not a CI gate (yet). Future
 * Q2 work can flip the exit code on threshold breaches.
 */

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const AUDIO_ROOT = join(ROOT, 'src', 'assets', 'audio', 'su');
const STAGES = [
  { dir: 'stage-01', stageId: 'hotel-lobby-basics', stageNumber: 1 },
  { dir: 'stage-02', stageId: 'front-desk-check-in', stageNumber: 2 },
  { dir: 'all', stageId: 'street-food-order', stageNumber: 3 },
];

function listAudioIds(dir) {
  const fullPath = join(AUDIO_ROOT, dir);
  if (!existsSync(fullPath)) return new Set();
  // Each audio line on disk has both .wav and .mp3; we only want the unique
  // ids, so strip the extension.
  const files = readdirSync(fullPath, { withFileTypes: true });
  const ids = new Set();
  for (const file of files) {
    if (!file.isFile()) continue;
    const match = /^(.+)\.(wav|mp3)$/.exec(file.name);
    if (match) ids.add(match[1]);
  }
  return ids;
}

function loadLessonScenarios() {
  // We can't import lessonScenarios.ts directly from an .mjs script without
  // a build step, so we parse the source for phrase ids and stage scenario
  // ids. Cheap and good enough for a coverage report.
  const source = readFileSync(join(ROOT, 'src', 'data', 'lessonScenarios.ts'), 'utf8');
  const scenarioBlocks = [];
  // Each scenario starts with `id: '...'`. We split on top-level scenario
  // markers and harvest phrase ids inside each block.
  const scenarioRegex = /id: '([^']+)',\s*\n\s*scenarioNumber:\s*(\d+)/g;
  let match;
  const positions = [];
  while ((match = scenarioRegex.exec(source)) !== null) {
    positions.push({ index: match.index, id: match[1], number: Number(match[2]) });
  }
  for (let i = 0; i < positions.length; i += 1) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : source.length;
    const block = source.slice(start, end);
    const phraseIds = [];
    for (const phraseMatch of block.matchAll(/(?:phrase|id):\s*['"]([\w-]+)['"]/g)) {
      const id = phraseMatch[1];
      // Filter out the scenario / chunk / equipment / super-move ids — only
      // keep ones that look like phrase ids (lower-kebab-case, not the
      // scenario id we just captured).
      if (id === positions[i].id) continue;
      if (
        ['traveler-notebook', 'wai-of-clarity', 'first-contact', 'polite-repair', 'first-needs'].includes(id)
      )
        continue;
      phraseIds.push(id);
    }
    scenarioBlocks.push({
      id: positions[i].id,
      number: positions[i].number,
      phraseIds: [...new Set(phraseIds)].filter((id) =>
        // Heuristic: real phrase ids appear inside phrase(...) calls or as
        // explicit `id:` keys in phrase objects. Drop tokens that look like
        // chunk / equipment / super-move slugs.
        /-/.test(id) || /^\w{2,}$/.test(id),
      ),
    });
  }
  return scenarioBlocks;
}

function classify(audioId, presentIds) {
  return presentIds.has(audioId) ? '✓' : '·';
}

function pad(str, width) {
  return String(str).padEnd(width, ' ');
}

function report() {
  const scenarios = loadLessonScenarios();
  // We only care about Stages 1-3 for the tech demo — the rest stay on the
  // future-work column.
  const playableScenarios = scenarios.filter((s) => s.number <= 3);
  const futureScenarios = scenarios.filter((s) => s.number > 3);

  const present01 = listAudioIds('stage-01');
  const present02 = listAudioIds('stage-02');
  const presentAll = listAudioIds('all');

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Bangkok Rift — Audio Coverage Report');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Files on disk:`);
  console.log(`    src/assets/audio/su/stage-01/  ${present01.size} unique ids`);
  console.log(`    src/assets/audio/su/stage-02/  ${present02.size} unique ids`);
  console.log(`    src/assets/audio/su/all/       ${presentAll.size} unique ids`);
  console.log('');

  console.log('───────────────────────────────────────────────────────────────────');
  console.log('  Tech demo stages (1-3)');
  console.log('───────────────────────────────────────────────────────────────────');

  let totalExpected = 0;
  let totalPresent = 0;

  for (const scenario of playableScenarios) {
    const stageDir = STAGES[scenario.number - 1];
    const localIds = stageDir.dir === 'stage-01' ? present01 : stageDir.dir === 'stage-02' ? present02 : presentAll;
    // The Su VO files are named two ways:
    //   - intro lines: stage-NN-<lineId>-su / stage-NN-<lineId>-coach
    //   - stage 1 only: dialogue-hotel-lobby-basics-NN (the older format)
    // We accept either the explicit "stage-NN-<phrase>-su" or the alternate
    // "stage-NN-<phrase>" name when checking coverage.
    const expectedSu = scenario.phraseIds.map((id) => `stage-${String(scenario.number).padStart(2, '0')}-${id}-su`);
    const expectedCoach = scenario.phraseIds.map((id) => `stage-${String(scenario.number).padStart(2, '0')}-${id}-coach`);

    const presentSu = expectedSu.filter((id) => localIds.has(id) || presentAll.has(id));
    const presentCoach = expectedCoach.filter((id) => localIds.has(id) || presentAll.has(id));

    totalExpected += expectedSu.length + expectedCoach.length;
    totalPresent += presentSu.length + presentCoach.length;

    console.log('');
    console.log(`  Stage ${scenario.number}: ${scenario.id}`);
    console.log(`    Su prompt audio:    ${presentSu.length}/${expectedSu.length}`);
    console.log(`    Coach audio:        ${presentCoach.length}/${expectedCoach.length}`);

    const missingSu = expectedSu.filter((id) => !localIds.has(id) && !presentAll.has(id));
    const missingCoach = expectedCoach.filter((id) => !localIds.has(id) && !presentAll.has(id));
    if (missingSu.length || missingCoach.length) {
      console.log(`    Missing:`);
      for (const id of [...missingSu, ...missingCoach]) {
        console.log(`      ${classify(id, localIds)} ${id}`);
      }
    }
  }

  console.log('');
  console.log('───────────────────────────────────────────────────────────────────');
  const pct = totalExpected === 0 ? 100 : Math.round((totalPresent / totalExpected) * 100);
  console.log(`  Demo coverage: ${totalPresent}/${totalExpected} files (${pct}%)`);
  console.log('───────────────────────────────────────────────────────────────────');

  if (futureScenarios.length > 0) {
    console.log('');
    console.log('  Post-demo stages (not in the tech-demo build):');
    for (const scenario of futureScenarios) {
      console.log(`    Stage ${scenario.number}: ${scenario.id} — ${scenario.phraseIds.length} phrases (no audio expected yet)`);
    }
  }

  console.log('');
  // Exit 0 — informational only. Q2 work can flip thresholds later.
  process.exit(0);
}

report();
