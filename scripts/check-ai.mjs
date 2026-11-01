import { existsSync, readFileSync } from 'node:fs';

function loadEnv(path) {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv('.env.local');
loadEnv('.env');

const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';

if (!apiKey || apiKey.startsWith('REPLACE_ME_')) {
  console.error('GEMINI_API_KEY is not configured in .env.local');
  process.exit(1);
}

console.log('Checking Gemini...');
console.log(`  Model: ${model}`);

const response = await fetch(
  'https://generativelanguage.googleapis.com/v1/interactions',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input: 'Return a short status object confirming the API is working.',
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['ok', 'message'],
        },
      },
    }),
  },
);

const body = await response.json();

if (!response.ok) {
  console.error('Gemini: FAILED');
  console.error(
    body?.error?.message ||
      JSON.stringify(body?.error ?? body, null, 2).slice(0, 2000),
  );
  process.exit(1);
}

const modelOutput = Array.isArray(body?.steps)
  ? [...body.steps].reverse().find((step) => step?.type === 'model_output')
  : undefined;

const text = Array.isArray(modelOutput?.content)
  ? modelOutput.content
      .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
      .map((item) => item.text)
      .join('')
  : '';

if (!text) {
  console.error('Gemini: FAILED');
  console.error('The request succeeded but no model text output was returned.');
  process.exit(1);
}

console.log('Gemini: OK');
console.log(`  Response: ${text}`);
