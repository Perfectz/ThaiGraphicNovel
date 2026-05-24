import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(rootDir, 'src/assets/audio/conversation');
const manifestPath = resolve(rootDir, 'src/generated/conversationAudioManifest.ts');
const openAiSpeechUrl = 'https://api.openai.com/v1/audio/speech';
const defaultModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const defaultFormat = process.env.OPENAI_TTS_FORMAT || 'mp3';
const defaultDelayMs = Number(process.env.OPENAI_TTS_DELAY_MS || 250);

const voiceBySpeaker = {
  Su: process.env.OPENAI_TTS_SU_VOICE || 'marin',
  Patrick: process.env.OPENAI_TTS_PATRICK_VOICE || 'cedar',
  Narrator: process.env.OPENAI_TTS_NARRATOR_VOICE || 'sage',
};

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
  const require = () => ({});
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled);
  fn(module.exports, require, module, filename, dirname(filename));
  return module.exports;
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80);
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
  };
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  if (!apiKey || !apiKey.startsWith('sk-') || /YOUR_|ROTATED|PLACEHOLDER|NEW/.test(apiKey)) return '';
  return apiKey;
}

function buildAudioItems() {
  const { lessonScenarios } = loadTsModule('src/data/lessonScenarios.ts');
  const { buildScenarioDialogue } = loadTsModule('src/data/dialogue.ts');
  const dialogueItems = [];
  const phraseItems = [];

  for (const scenario of lessonScenarios) {
    const lines = buildScenarioDialogue(scenario);
    lines.forEach((line, lineIndex) => {
      const id = `dialogue-${scenario.id}-${String(lineIndex + 1).padStart(2, '0')}`;
      const spokenText = [line.text, line.thai, line.translation ? `Meaning: ${line.translation}.` : '']
        .filter(Boolean)
        .join(' ');

      dialogueItems.push({
        id,
        type: 'dialogue',
        speaker: line.speaker,
        text: spokenText,
        voice: voiceBySpeaker[line.speaker] ?? voiceBySpeaker.Narrator,
        outputPath: resolve(outputDir, 'dialogue', scenario.id, `${String(lineIndex + 1).padStart(2, '0')}-${slugify(line.speaker)}.${defaultFormat}`),
      });
    });

    for (const phrase of scenario.chunks.flatMap((chunk) => chunk.phrases)) {
      phraseItems.push({
        id: phrase.id,
        type: 'phrase',
        speaker: 'Su',
        text: phrase.targetPhrase,
        voice: voiceBySpeaker.Su,
        outputPath: resolve(outputDir, 'phrases', `${slugify(phrase.id)}.${defaultFormat}`),
      });
    }
  }

  return [...dialogueItems, ...phraseItems];
}

function writeManifest(items) {
  const existingItems = items.filter((item) => existsSync(item.outputPath));
  const importLines = [];
  const dialogueMapLines = [];
  const phraseMapLines = [];

  existingItems.forEach((item, index) => {
    const importName = `audio${index}`;
    const relativePath = relative(dirname(manifestPath), item.outputPath).replace(/\\/g, '/');
    importLines.push(`import ${importName} from '${relativePath.startsWith('.') ? relativePath : `./${relativePath}`}';`);
    const mapLine = `  ${JSON.stringify(item.id)}: ${importName},`;
    if (item.type === 'dialogue') dialogueMapLines.push(mapLine);
    if (item.type === 'phrase') phraseMapLines.push(mapLine);
  });

  const contents = `${importLines.join('\n')}${importLines.length ? '\n\n' : ''}` +
    `export const generatedDialogueAudioById: Partial<Record<string, string>> = {\n${dialogueMapLines.join('\n')}\n};\n\n` +
    `export const generatedPhraseAudioById: Partial<Record<string, string>> = {\n${phraseMapLines.join('\n')}\n};\n`;

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, contents, 'utf8');
  return existingItems.length;
}

async function generateAudio(item, { apiKey, format }) {
  mkdirSync(dirname(item.outputPath), { recursive: true });
  const response = await fetch(openAiSpeechUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: defaultModel,
      voice: item.voice,
      input: item.text,
      response_format: format,
      instructions: item.type === 'phrase'
        ? 'Speak the Thai phrase naturally and clearly for a beginner language learner.'
        : 'Read this visual novel line naturally with clear emotion, suitable for a Japanese dating sim style game.',
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI speech request failed for ${item.id}: HTTP ${response.status} ${detail}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(item.outputPath.replace(/\.[^.]+$/, `.${format}`), bytes);
}

async function main() {
  loadLocalEnv();
  const options = parseArgs();
  const apiKey = getApiKey();
  const allItems = buildAudioItems().map((item) => ({
    ...item,
    outputPath: item.outputPath.replace(/\.[^.]+$/, `.${options.format}`),
  }));
  const missingItems = allItems.filter((item) => options.force || !existsSync(item.outputPath));
  const limitedItems = options.limit > 0 ? missingItems.slice(0, options.limit) : missingItems;

  if (options.dryRun) {
    const manifestCount = writeManifest(allItems);
    console.log(`Audio plan: ${allItems.length} total, ${missingItems.length} missing, ${manifestCount} in manifest.`);
    for (const item of missingItems.slice(0, 20)) {
      console.log(`missing ${item.type}: ${item.id}`);
    }
    if (missingItems.length > 20) console.log(`...and ${missingItems.length - 20} more`);
    return;
  }

  if (!apiKey) {
    writeManifest(allItems);
    throw new Error('OPENAI_API_KEY is missing or still a placeholder. Add a real key to .env.local, then run npm run audio:generate.');
  }

  for (const [index, item] of limitedItems.entries()) {
    console.log(`[${index + 1}/${limitedItems.length}] ${item.type} ${item.id}`);
    await generateAudio(item, { apiKey, format: options.format });
    if (defaultDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, defaultDelayMs));
  }

  const manifestCount = writeManifest(allItems);
  console.log(`Generated ${limitedItems.length} audio files. Manifest contains ${manifestCount} files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
