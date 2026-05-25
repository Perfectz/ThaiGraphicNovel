import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const realtimeUrl = 'wss://api.openai.com/v1/realtime';
const fallbackModel = 'gpt-realtime-2';
const fallbackVoice = 'sage';
const defaultSpeed = Number(process.env.OPENAI_REALTIME_AUDIO_SPEED || 1);
const defaultFormat = process.env.OPENAI_REALTIME_AUDIO_FORMAT || 'mp3';
const sampleRate = Number(process.env.OPENAI_REALTIME_AUDIO_SAMPLE_RATE || 24000);
const defaultDelayMs = Number(process.env.OPENAI_REALTIME_AUDIO_DELAY_MS || 500);
const maxGenerationAttempts = Number(process.env.OPENAI_REALTIME_AUDIO_ATTEMPTS || 3);
const bannedPreamblePatterns = [
  /\balright\b/i,
  /\bokay\b/i,
  /\bsure\b/i,
  /\blet me\b/i,
  /\bi will\b/i,
  /\bi'll\b/i,
  /\bas su\b/i,
  /\bjust like su\b/i,
  /\bin the scene\b/i,
  /\bvoice actor\b/i,
  /\bhere'?s\b/i,
  /\bthe line\b/i,
  /\brecite\b/i,
];

const audioStageConfigs = {
  '1': {
    stageSlug: 'stage-01',
    planLabel: 'Stage 1 Su',
    dataPath: 'src/data/stageOneSuVoiceLines.ts',
    dataExportName: 'stageOneSuVoiceLines',
    outputDir: resolve(rootDir, 'src/assets/audio/su/stage-01'),
    manifestPath: resolve(rootDir, 'src/generated/stageOneSuAudioManifest.ts'),
    manifestExportName: 'generatedStageOneSuAudioById',
    importPrefix: 'stageOneSuAudio',
    tempPrefix: 'stage-one-su',
    generationCommand: 'npm run audio:su:generate',
  },
  '2': {
    stageSlug: 'stage-02',
    planLabel: 'Stage 2 Su',
    dataPath: 'src/data/stageTwoSuBriefing.ts',
    dataExportName: 'stageTwoSuBriefingLines',
    outputDir: resolve(rootDir, 'src/assets/audio/su/stage-02'),
    manifestPath: resolve(rootDir, 'src/generated/stageTwoSuAudioManifest.ts'),
    manifestExportName: 'generatedStageTwoSuAudioById',
    importPrefix: 'stageTwoSuAudio',
    tempPrefix: 'stage-two-su',
    generationCommand: 'npm run audio:su:stage2:generate',
  },
  all: {
    stageSlug: 'all-su',
    planLabel: 'All remaining Su',
    dataPath: 'src/data/suVoiceLines.ts',
    dataExportName: 'suVoiceLines',
    outputDir: resolve(rootDir, 'src/assets/audio/su/all'),
    manifestPath: resolve(rootDir, 'src/generated/suAudioManifest.ts'),
    manifestExportName: 'generatedSuAudioById',
    importPrefix: 'suAudio',
    tempPrefix: 'su-all',
    generationCommand: 'npm run audio:su:all:generate',
  },
  characters: {
    stageSlug: 'characters-02-03',
    planLabel: 'Level 2-3 character',
    dataPath: 'src/data/characterVoiceLines.ts',
    dataExportName: 'characterVoiceLines',
    outputDir: resolve(rootDir, 'src/assets/audio/characters/levels-02-03'),
    manifestPath: resolve(rootDir, 'src/generated/characterVoiceAudioManifest.ts'),
    manifestExportName: 'generatedCharacterVoiceAudioById',
    importPrefix: 'characterVoiceAudio',
    tempPrefix: 'character-voice',
    generationCommand: 'npm run audio:characters:generate',
  },
};

const tsModuleCache = new Map();

function loadLocalEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = resolve(rootDir, envFile);
    if (!existsSync(envPath)) continue;

    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
    }
  }
}

function loadTsModule(pathFromRoot) {
  const filename = resolve(rootDir, pathFromRoot);
  if (tsModuleCache.has(filename)) return tsModuleCache.get(filename).exports;

  const source = readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  tsModuleCache.set(filename, module);
  const require = (request) => loadRequiredModule(filename, request);
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled);
  fn(module.exports, require, module, filename, dirname(filename));
  return module.exports;
}

function loadRequiredModule(parentFilename, request) {
  if (!request.startsWith('.') && !request.startsWith('/')) return {};

  const basePath = request.startsWith('/')
    ? request
    : resolve(dirname(parentFilename), request);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.json`,
    resolve(basePath, 'index.ts'),
  ];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) return {};

  if (/\.(png|jpg|jpeg|webp|gif|svg|mp3|wav|mp4)$/i.test(resolved)) return '';
  if (resolved.endsWith('.json')) return JSON.parse(readFileSync(resolved, 'utf8'));

  const relativePath = relative(rootDir, resolved).replace(/\\/g, '/');
  return loadTsModule(relativePath);
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const getValue = (name, fallback) => {
    const prefix = `${name}=`;
    const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
  };

  return {
    dryRun: args.has('--dry-run'),
    force: args.has('--force'),
    format: getValue('--format', defaultFormat),
    limit: Number(getValue('--limit', '0')),
    stage: getValue('--stage', '1'),
  };
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  if (!apiKey || !apiKey.startsWith('sk-') || /YOUR_|ROTATED|PLACEHOLDER|NEW/.test(apiKey)) return '';
  return apiKey;
}

function getAudioStageConfig(stage) {
  const config = audioStageConfigs[stage];
  if (!config) throw new Error(`Unsupported audio stage "${stage}". Use --stage=1, --stage=2, --stage=all, or --stage=characters.`);
  return {
    ...config,
    provenancePath: resolve(config.outputDir, 'provenance.json'),
  };
}

function buildAudioItems(config, format) {
  const moduleExports = loadTsModule(config.dataPath);
  const voiceLines = moduleExports[config.dataExportName];
  if (!Array.isArray(voiceLines)) {
    throw new Error(`${config.dataPath} did not export ${config.dataExportName}.`);
  }
  return voiceLines.map((line) => ({
    ...line,
    model: line.model ?? fallbackModel,
    voice: line.voice ?? fallbackVoice,
    category: line.category ?? 'intro',
    outputPath: resolve(config.outputDir, `${line.id}.${format}`),
  }));
}

function writeManifest(config, items) {
  const existingItems = items.filter((item) => existsSync(item.outputPath));
  const importLines = [];
  const mapLines = [];

  existingItems.forEach((item, index) => {
    const importName = `${config.importPrefix}${index}`;
    const relativePath = relative(dirname(config.manifestPath), item.outputPath).replace(/\\/g, '/');
    importLines.push(`import ${importName} from '${relativePath.startsWith('.') ? relativePath : `./${relativePath}`}';`);
    mapLines.push(`  ${JSON.stringify(item.id)}: ${importName},`);
  });

  const contents = `${importLines.join('\n')}${importLines.length ? '\n\n' : ''}` +
    `export const ${config.manifestExportName}: Partial<Record<string, string>> = {\n${mapLines.join('\n')}\n};\n`;

  mkdirSync(dirname(config.manifestPath), { recursive: true });
  writeFileSync(config.manifestPath, contents, 'utf8');
  return existingItems.length;
}

function readProvenance(config) {
  if (!existsSync(config.provenancePath)) return {};
  try {
    return JSON.parse(readFileSync(config.provenancePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeProvenance(config, provenanceById) {
  mkdirSync(dirname(config.provenancePath), { recursive: true });
  writeFileSync(config.provenancePath, `${JSON.stringify(provenanceById, null, 2)}\n`, 'utf8');
}

function addSocketListener(socket, eventName, handler) {
  if (typeof socket.addEventListener === 'function') {
    socket.addEventListener(eventName, (event) => handler(event.data ?? event));
    return;
  }
  socket.on(eventName, handler);
}

async function createRealtimeSocket(apiKey, model) {
  const url = `${realtimeUrl}?model=${encodeURIComponent(model)}`;

  try {
    const { default: WebSocketModule } = await import('ws');
    return new WebSocketModule(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Safety-Identifier': 'thai-quest-local-audio-generator',
      },
    });
  } catch {
    return new WebSocket(url, [
      'realtime',
      `openai-insecure-api-key.${apiKey}`,
    ]);
  }
}

function sendJson(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function closeSocket(socket) {
  try {
    socket.close();
  } catch {
    // Best effort cleanup only.
  }
}

function createSpokenScript(text) {
  return text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function createPerformanceInstructions(item) {
  const lineType = item.id.endsWith('-coach') ? 'coaching' : item.category === 'intro' ? 'intro' : 'reaction';
  const speaker = item.speaker ?? 'Su';
  return [
    `You are recording FINAL in-game voice-over audio for ${speaker} in a bright RPG Thai-learning visual novel.`,
    'Your audio will be inserted directly into the game. There is no editor and no cleanup pass.',
    'CRITICAL: Begin immediately with the first word of the supplied line. End immediately after the last word.',
    `CRITICAL: Say only ${speaker}'s line. Do not introduce it, explain it, describe the scene, mention ${speaker}, mention voice acting, or say anything like "alright", "okay", "sure", "let me", "as ${speaker}", "the line is", or "in the scene".`,
    `${speaker} is a character in an expressive Thai-learning RPG. Keep the delivery natural, specific, and in-character.`,
    'Act the line as natural dialogue with emotion, not narration. Use small pauses, a light smile, and real conversational rhythm.',
    lineType === 'coaching'
      ? 'This is a coaching line: make the breakdown patient and clear, then make the final repeat slower and easier to copy.'
      : 'This is a conversation line: make it feel like Su is reacting to Patrick in the scene.',
    'Do not read punctuation names, XML tags, parentheses, stage directions, or metadata.',
    'If the supplied text is inside <line> tags, speak only the text inside those tags. Never say the tags.',
  ].join('\n');
}

function normalizeForValidation(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateOutputTranscript(item, transcript, spokenScript) {
  const normalizedTranscript = normalizeForValidation(transcript);
  const normalizedScript = normalizeForValidation(spokenScript);
  const problems = [];
  const startsWithScript = normalizedTranscript && normalizedScript
    ? normalizedTranscript.startsWith(normalizedScript.slice(0, Math.min(18, normalizedScript.length)))
    : false;

  if (startsWithScript) return;

  for (const pattern of bannedPreamblePatterns) {
    if (pattern.test(transcript)) problems.push(`banned preamble phrase matched ${pattern}`);
  }

  if (normalizedTranscript && normalizedScript) {
    problems.push('output transcript does not appear to start with the supplied line');
  }

  if (problems.length) {
    throw new Error(`Generated audio for ${item.id} included extra speech: ${problems.join('; ')}. Transcript: ${transcript}`);
  }
}

async function generateRealtimePcm(config, item, apiKey) {
  const socket = await createRealtimeSocket(apiKey, item.model);
  const chunks = [];
  let transcript = '';
  let isSettled = false;
  let hasRequestedResponse = false;
  const spokenScript = createSpokenScript(item.text);
  const provenance = {
    id: item.id,
    generatedAt: new Date().toISOString(),
    endpoint: `${realtimeUrl}?model=${item.model}`,
    requestedModel: item.model,
    requestedVoice: item.voice,
    requestedSpeed: defaultSpeed,
    spokenScript,
    sessionCreatedModel: null,
    sessionCreatedVoice: null,
    sessionUpdatedModel: null,
    sessionUpdatedVoice: null,
    responseId: null,
    responseDoneStatus: null,
  };

  return await new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      closeSocket(socket);
      reject(new Error(`Realtime audio timed out for ${item.id}.`));
    }, 120000);

    function finish() {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutId);
      closeSocket(socket);
      if (!chunks.length) {
        reject(new Error(`Realtime returned no audio chunks for ${item.id}${transcript ? `; transcript: ${transcript}` : ''}.`));
        return;
      }
      provenance.outputTranscript = transcript.trim();
      resolve({ pcmBytes: Buffer.concat(chunks), provenance });
    }

    function fail(error) {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutId);
      closeSocket(socket);
      reject(error instanceof Error ? error : new Error(String(error)));
    }

    function requestResponse() {
      if (hasRequestedResponse) return;
      hasRequestedResponse = true;
      sendJson(socket, {
        type: 'response.create',
        response: {
          conversation: 'none',
          output_modalities: ['audio'],
          instructions: createPerformanceInstructions(item),
          metadata: {
            stage: config.stageSlug,
            audio_id: item.id,
            requested_model: item.model,
            requested_voice: item.voice,
          },
          input: [
            {
          type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `<line>${spokenScript}</line>`,
                },
              ],
            },
          ],
        },
      });
    }

    addSocketListener(socket, 'open', () => {
      sendJson(socket, {
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: 'Generate final in-game voice acting. The audio must contain only the supplied line, with no preamble, no explanation, and no extra words.',
          reasoning: { effort: 'low' },
          audio: {
            output: {
              voice: item.voice,
              speed: defaultSpeed,
            },
          },
        },
      });
    });

    addSocketListener(socket, 'message', (message) => {
      const raw = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
      const event = JSON.parse(raw);

      if (event.type === 'error') {
        fail(new Error(event.error?.message ?? `Realtime error for ${item.id}.`));
        return;
      }

      if (event.type === 'session.created') {
        provenance.sessionCreatedModel = event.session?.model ?? null;
        provenance.sessionCreatedVoice = event.session?.audio?.output?.voice ?? null;
        return;
      }

      if (event.type === 'session.updated') {
        provenance.sessionUpdatedModel = event.session?.model ?? null;
        provenance.sessionUpdatedVoice = event.session?.audio?.output?.voice ?? null;
        requestResponse();
        return;
      }

      if (event.type === 'response.created') {
        provenance.responseId = event.response?.id ?? null;
        return;
      }

      if (event.type === 'response.output_audio.delta' || event.type === 'response.audio.delta') {
        chunks.push(Buffer.from(event.delta, 'base64'));
        return;
      }

      if (event.type === 'response.output_audio_transcript.delta' || event.type === 'response.audio_transcript.delta') {
        transcript += event.delta ?? '';
        return;
      }

      if (event.type === 'response.done') {
        provenance.responseDoneStatus = event.response?.status ?? null;
        finish();
        return;
      }

      if (event.type === 'response.output_audio.done' || event.type === 'response.audio.done') {
        finish();
      }
    });

    addSocketListener(socket, 'error', fail);
  });
}

async function generateValidatedRealtimePcm(config, item, apiKey) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxGenerationAttempts; attempt += 1) {
    try {
      const result = await generateRealtimePcm(config, item, apiKey);
      validateOutputTranscript(item, result.provenance.outputTranscript, result.provenance.spokenScript);
      result.provenance.attempt = attempt;
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`Retrying ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw lastError ?? new Error(`Failed to generate valid audio for ${item.id}.`);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}.`));
    });
  });
}

async function convertPcmToAudio(config, pcmBytes, outputPath, format) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const rawPath = resolve(tmpdir(), `${config.tempPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.pcm`);
  writeFileSync(rawPath, pcmBytes);
  const formatArgs = format === 'wav'
    ? ['-codec:a', 'pcm_s16le']
    : ['-codec:a', 'libmp3lame', '-b:a', '128k'];

  try {
    await runFfmpeg([
      '-y',
      '-loglevel',
      'error',
      '-f',
      's16le',
      '-ar',
      String(sampleRate),
      '-ac',
      '1',
      '-i',
      rawPath,
      ...formatArgs,
      outputPath,
    ]);
  } finally {
    rmSync(rawPath, { force: true });
  }
}

async function main() {
  loadLocalEnv();
  const options = parseArgs();
  const config = getAudioStageConfig(options.stage);
  const apiKey = getApiKey();
  if (!['mp3', 'wav'].includes(options.format)) {
    throw new Error(`Unsupported audio format "${options.format}". Use mp3 or wav.`);
  }

  const allItems = buildAudioItems(config, options.format);
  const missingItems = allItems.filter((item) => options.force || !existsSync(item.outputPath));
  const limitedItems = options.limit > 0 ? missingItems.slice(0, options.limit) : missingItems;

  if (options.dryRun) {
    const manifestCount = writeManifest(config, allItems);
    console.log(`${config.planLabel} Realtime audio plan: ${allItems.length} total, ${missingItems.length} missing, ${manifestCount} in manifest.`);
    for (const item of missingItems.slice(0, 30)) {
      console.log(`missing ${item.category}: ${item.id}`);
    }
    if (missingItems.length > 30) console.log(`...and ${missingItems.length - 30} more`);
    return;
  }

  if (!apiKey) {
    writeManifest(config, allItems);
    throw new Error(`OPENAI_API_KEY is missing or still a placeholder. Add a real key to .env.local or the process environment, then run ${config.generationCommand}.`);
  }

  for (const [index, item] of limitedItems.entries()) {
    console.log(`[${index + 1}/${limitedItems.length}] ${item.id} (${item.voice}, ${item.model})`);
    const { pcmBytes, provenance } = await generateValidatedRealtimePcm(config, item, apiKey);
    provenance.requestedFormat = options.format;
    await convertPcmToAudio(config, pcmBytes, item.outputPath, options.format);
    const provenanceById = readProvenance(config);
    provenanceById[item.id] = provenance;
    writeProvenance(config, provenanceById);
    if (defaultDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, defaultDelayMs));
  }

  const manifestCount = writeManifest(config, allItems);
  console.log(`Generated ${limitedItems.length} ${config.planLabel} audio files. Manifest contains ${manifestCount} files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
