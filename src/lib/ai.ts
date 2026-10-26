import OpenAI from 'openai';
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

export async function generateCampaignDraft(
  input: GenerateCampaignInput,
): Promise<{ draft: GeneratedCampaignDraft; model: string }> {
  if (!process.env.OPENAI_API_KEY) {
    if (process.env.MARKETPILOT_DEMO_MODE === 'true') {
      return { draft: fallbackDraft(input), model: 'demo' };
    }
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const client = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = process.env.OPENAI_MODEL || 'gpt-6-luna';

  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content:
          'You are MarketPilot, a precise marketing campaign assistant for nontechnical small-business owners. Never invent prices, discounts, dates, availability, guarantees, testimonials, regulated claims, or business facts. If the user did not supply a concrete offer, set offer to null. Create channel-specific copy. Email must include a subject. Return JSON only, exactly matching the requested schema.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          request: input.request,
          business: input.business,
          schema: {
            title: 'string',
            objective: 'string',
            caption: 'string',
            offer: 'string|null',
            callToAction: 'string',
            channels: [
              {
                channel: 'INSTAGRAM|TIKTOK|X|EMAIL',
                enabled: 'boolean',
                copy: 'string',
                subject: 'string|null',
              },
            ],
          },
        }),
      },
    ],
  });

  const raw = response.output_text.trim();
  const normalized = raw.startsWith('```')
    ? raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '')
    : raw;

  const parsed = campaignDraftSchema.parse(JSON.parse(normalized));
  return { draft: parsed, model };
}
