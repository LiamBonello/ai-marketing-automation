import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import OpenAI from 'openai';
import type { AuthContext } from '@/lib/auth';
import { requireEnv } from '@/lib/app-config';
import { debitCredits } from '@/lib/credits';
import { getDb } from '@/lib/db';

const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
  ['video/webm', 'webm'],
]);

function s3(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    },
  });
}

function objectUrl(key: string): string {
  const base = requireEnv('S3_PUBLIC_BASE_URL').replace(/\/$/, '');
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function createUploadUrl(input: {
  auth: AuthContext;
  contentType: string;
  fileSize: number;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const extension = allowedTypes.get(input.contentType);
  if (!extension) throw new Error('Unsupported media type.');
  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0 || input.fileSize > 250 * 1024 * 1024) {
    throw new Error('Media must be between 1 byte and 250 MB.');
  }

  const key = `businesses/${input.auth.businessId}/uploads/${Date.now()}-${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: requireEnv('S3_BUCKET'),
    Key: key,
    ContentType: input.contentType,
    ContentLength: input.fileSize,
  });

  const uploadUrl = await getSignedUrl(s3(), command, {
    expiresIn: 10 * 60,
    signableHeaders: new Set(['content-type', 'content-length']),
  });

  return { uploadUrl, publicUrl: objectUrl(key), key };
}

export async function putMedia(input: {
  businessId: string;
  bytes: Buffer;
  contentType: string;
  extension: string;
}): Promise<string> {
  const key = `businesses/${input.businessId}/generated/${Date.now()}-${randomUUID()}.${input.extension}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: requireEnv('S3_BUCKET'),
      Key: key,
      Body: input.bytes,
      ContentType: input.contentType,
    }),
  );
  return objectUrl(key);
}

export async function generateCampaignImage(
  auth: AuthContext,
  campaignId: string,
  prompt?: string,
): Promise<string> {
  const campaign = await getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
    include: {
      business: true,
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');

  const organization = await getDb().organization.findUniqueOrThrow({
    where: { id: auth.organizationId },
    select: { creditBalance: true },
  });
  if (organization.creditBalance < 5) throw new Error('INSUFFICIENT_CREDITS');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');

  const latest = campaign.versions[0];
  const imagePrompt =
    prompt?.trim() ||
    [
      `Create a polished social media marketing image for ${campaign.business.name}.`,
      `Campaign: ${campaign.title}.`,
      `Objective: ${campaign.objective}.`,
      latest?.offer ? `Offer context: ${latest.offer}.` : '',
      campaign.business.industry ? `Industry: ${campaign.business.industry}.` : '',
      campaign.business.brandGuidelines ? `Brand guidance: ${campaign.business.brandGuidelines}.` : '',
      'Do not add prices, dates, claims, logos, or text that were not explicitly provided. Prefer a clean commercial composition suitable for Instagram.',
    ].filter(Boolean).join(' ');

  const client = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-6-luna',
    input: imagePrompt,
    tools: [
      {
        type: 'image_generation',
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare',
        size: '1024x1024',
        quality: 'medium',
        output_format: 'webp',
      },
    ],
  });

  const item = response.output.find(
    (entry): entry is typeof entry & { type: 'image_generation_call'; result: string } =>
      entry.type === 'image_generation_call' && typeof (entry as { result?: unknown }).result === 'string',
  );
  if (!item?.result) throw new Error('Image generation did not return an image.');

  const mediaUrl = await putMedia({
    businessId: auth.businessId,
    bytes: Buffer.from(item.result, 'base64'),
    contentType: 'image/webp',
    extension: 'webp',
  });

  await debitCredits({
    organizationId: auth.organizationId,
    amount: 5,
    reason: 'campaign_image_generation',
    externalRef: `campaign-image:${campaign.id}:${randomUUID()}`,
  });

  await setCampaignMedia(auth, campaignId, mediaUrl);
  return mediaUrl;
}

export async function setCampaignMedia(
  auth: AuthContext,
  campaignId: string,
  mediaUrl: string,
): Promise<void> {
  const parsed = new URL(mediaUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Media URL must be HTTP(S).');

  const campaign = await getDb().campaign.findFirst({
    where: { id: campaignId, businessId: auth.businessId },
    select: { status: true },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (['PUBLISHING', 'PUBLISHED'].includes(campaign.status)) {
    throw new Error('Media cannot be changed after publishing starts.');
  }

  await getDb().$transaction(async (tx) => {
    await tx.campaignChannel.updateMany({
      where: {
        campaignId,
        channel: { in: ['INSTAGRAM', 'TIKTOK'] },
      },
      data: { mediaUrl },
    });

    if (campaign.status === 'APPROVED' || campaign.status === 'SCHEDULED') {
      await tx.publishJob.deleteMany({ where: { campaignId, status: 'PENDING' } });
      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: 'READY', approvedAt: null, scheduledFor: null },
      });
    }
  });
}
