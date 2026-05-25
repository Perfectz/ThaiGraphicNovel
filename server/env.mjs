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

/**
 * Returns true when the server has a usable OPENAI_API_KEY in its environment
 * (loaded from .env.local or .env via loadLocalEnv()). The browser uses this
 * via the /api/realtime/health endpoint to decide whether the user needs to
 * enter their own key in Settings — when this is true, the server's env key
 * acts as the default and no user-supplied key is required.
 */
export function hasServerEnvApiKey() {
  return isUsableApiKey(process.env.OPENAI_API_KEY);
}

/**
 * Resolve which API key to use for an incoming request. Semantics:
 *   1. A user-supplied key (x-openai-api-key header) wins when usable — this
 *      lets a player override the server's default with their own account.
 *   2. Otherwise fall back to the server's env key — this is the "local .env
 *      acts as default key" path, the common dev/single-player setup.
 *   3. Otherwise return undefined and the caller errors out.
 */
export function getRequestApiKey(req) {
  const requestApiKey = getHeaderValue(req.headers['x-openai-api-key']);
  if (isUsableApiKey(requestApiKey)) return requestApiKey.trim();
  const envApiKey = process.env.OPENAI_API_KEY;
  return isUsableApiKey(envApiKey) ? envApiKey.trim() : undefined;
}

export function hasUsableApiKey(req) {
  const apiKey = getRequestApiKey(req);
  return isUsableApiKey(apiKey);
}
