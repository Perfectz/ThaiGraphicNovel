import { Readable } from 'node:stream';

export function createCorsHeaders(allowedOrigin = '*') {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-OpenAI-API-Key',
  };
}

export function sendJson(res, status, payload, corsHeaders) {
  res.writeHead(status, {
    ...corsHeaders,
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(payload));
}

export async function readText(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJson(req) {
  const body = await readText(req);
  if (!body.trim()) return {};
  return JSON.parse(body);
}

export async function readFormData(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === 'string') {
      headers.set(key, value);
    }
  }

  const request = new Request(`http://localhost${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: Readable.toWeb(req),
    duplex: 'half',
  });

  return request.formData();
}
