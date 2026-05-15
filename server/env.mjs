import { existsSync, readFileSync } from 'node:fs';

export const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2';

const API_KEY_PLACEHOLDERS = new Set([
  'YOUR_ROTATED_OPENAI_API_KEY',
  'YOUR_NEW_ROTATED_OPENAI_API_KEY',
]);

export function loadLocalEnv() {
  for (const envFile of ['.env.local', '.env']) {
    if (!existsSync(envFile)) continue;

    const lines = readFileSync(envFile, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

export function isUsableApiKey(apiKey) {
  const cleanApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  return Boolean(cleanApiKey && !API_KEY_PLACEHOLDERS.has(cleanApiKey));
}

function getHeaderValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function getRequestApiKey(req) {
  const requestApiKey = getHeaderValue(req.headers['x-openai-api-key']);
  const envApiKey = process.env.OPENAI_API_KEY;
  return isUsableApiKey(envApiKey) ? envApiKey.trim() : requestApiKey?.trim();
}

export function hasUsableApiKey(req) {
  const apiKey = getRequestApiKey(req);
  return isUsableApiKey(apiKey);
}
