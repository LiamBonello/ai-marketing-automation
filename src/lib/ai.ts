import { z } from 'zod';
import { requireEnv } from '@/lib/app-config';

const campaignDraftSchema = z.object({
  title: z.string().min(2).max(120),
  objective: z.string().min(2).max(180),
  caption: z.string().min(10).max(3000),
  offer: z.string().max(300).nullable(),
  callToAction: z.string().min(2).max(160),
  channels: z.array(
    z.object({
      channel: z.enum(['INSTAGRAM', 'TIKTOK', 'X', 'EMAIL']),
      enabled: z.boolean(),
      copy: z.string().min(1).max(5000),
      subject: z.string().max(180).nullable(),
    }),
  ).min(1),
});

export type GeneratedCampaignDraft = z.infer<typeof campaignDraftSchema>;

interface GenerateCampaignInput {
  request: string;
  business: {
    name: string;
    description?: string | null;
    industry?: string | null;
    tone?: string | null;
    targetAudience?: string | null;
    location?: string | null;
    primaryGoal?: string | null;
    brandGuidelines?: string | null;
  };
}

interface GeminiInteractionResponse {
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  errors?: Array<{
    message?: string;
  }>;
}

const campaignJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    objective: { type: 'string' },
    caption: { type: 'string' },
    offer: { type: ['string', 'null'] },
    callToAction: { type: 'string' },
    channels: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          channel: {
            type: 'string',
            enum: ['INSTAGRAM', 'TIKTOK', 'X', 'EMAIL'],
          },
          enabled: { type: 'boolean' },
          copy: { type: 'string' },
          subject: { type: ['string', 'null'] },
        },
        required: ['channel', 'enabled', 'copy', 'subject'],
      },
    },
  },
  required: [
    'title',
    'objective',
    'caption',
    'offer',
    'callToAction',
    'channels',
  ],
} as const;

function fallbackDraft(input: GenerateCampaignInput): GeneratedCampaignDraft {
  const name = input.business.name;
  const request = input.request.trim();

  return {
    title: request.length > 60 ? `${request.slice(0, 57)}...` : request,
    objective: input.business.primaryGoal || 'Increase engagement and conversions',
    caption: `${request}\n\nDiscover what ${name} has to offer and get in touch to learn more.`,
    offer: null,
    callToAction: 'Learn more',
    channels: [
      { channel: 'INSTAGRAM', enabled: true, copy: request, subject: null },
      { channel: 'TIKTOK', enabled: true, copy: request, subject: null },
      { channel: 'X', enabled: false, copy: request, subject: null },
      { channel: 'EMAIL', enabled: false, copy: request, subject: `${name}: latest update` },
    ],
  };
}

function outputText(response: GeminiInteractionResponse): string {
  const modelOutputs = response.steps?.filter((step) => step.type === 'model_output') ?? [];
  for (let stepIndex = modelOutputs.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const content = modelOutputs[stepIndex]?.content ?? [];
    const text = content
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('');
    if (text.trim()) return text.trim();
  }
  return '';
}

async function callGemini(
  model: string,
  input: GenerateCampaignInput,
): Promise<GeneratedCampaignDraft> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': requireEnv('GEMINI_API_KEY'),
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        'You are MarketPilot, a precise marketing campaign assistant for nontechnical small-business owners.',
        'Never invent prices, discounts, dates, availability, guarantees, testimonials, regulated claims, or business facts.',
        'If the user did not supply a concrete offer, set offer to null.',
        'Create channel-specific copy. Email must include a subject.',
        'Respect the confirmed business profile below.',
        '',
        JSON.stringify({
          request: input.request,
          business: input.business,
        }),
      ].join('\n'),
      generation_config: {
        thinking_level: 'low',
        max_output_tokens: 5000,
      },
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: campaignJsonSchema,
      },
    }),
    cache: 'no-store',
  });

  const data = (await response.json()) as GeminiInteractionResponse;

  if (!response.ok) {
    const message =
      data.errors?.map((error) => error.message).filter(Boolean).join('; ') ||
      `Gemini request failed (${response.status}).`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (data.status && data.status !== 'completed') {
    throw new Error(`Gemini interaction ended with status "${data.status}".`);
  }

  const raw = outputText(data);
  if (!raw) throw new Error('Gemini returned no structured campaign output.');

  return campaignDraftSchema.parse(JSON.parse(raw));
}

export async function generateCampaignDraft(
  input: GenerateCampaignInput,
): Promise<{ draft: GeneratedCampaignDraft; model: string }> {
  if (!process.env.GEMINI_API_KEY) {
    if (process.env.MARKETPILOT_DEMO_MODE === 'true') {
      return { draft: fallbackDraft(input), model: 'demo' };
    }
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';

  try {
    return {
      draft: await callGemini(primaryModel, input),
      model: primaryModel,
    };
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : undefined;

    if (
      fallbackModel !== primaryModel &&
      (status === 429 || status === 503)
    ) {
      return {
        draft: await callGemini(fallbackModel, input),
        model: fallbackModel,
      };
    }

    throw error;
  }
}
