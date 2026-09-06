import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const source = await readFile('src/data/lessonScenarios.ts', 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { lessonScenarios } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const phrases = lessonScenarios.slice(0, 9).flatMap(s => s.chunks.flatMap(c => c.phrases));
await mkdir('public/bangkok/audio', { recursive: true });
await writeFile('public/bangkok/audio/phrases.json', JSON.stringify(phrases.map(p => ({ id: p.id, text: p.targetPhrase })), null, 2));
console.log(`${phrases.length} Thai phrase recordings planned.`);
