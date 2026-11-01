import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { AssistantWorkspace } from '@/features/assistant/AssistantWorkspace';
import { getCampaign } from '@/lib/campaigns';
import { requirePageContext } from '@/lib/page-context';
import { serializeCampaign } from '@/lib/serializers';
import { mapLiveCampaign } from '@/mappers/campaignMapper';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePageContext();

  if (context.demo) {
    redirect('/');
  }

  const { id } = await params;
  const campaign = await getCampaign(context.auth!, id);

  if (!campaign) {
    notFound();
  }

  return (
    <AppShell identity={context.identity} demo={false}>
      <AssistantWorkspace
        mode="live"
        businessName={context.identity.businessName}
        creditBalance={context.identity.creditBalance}
        initialCampaign={mapLiveCampaign(serializeCampaign(campaign))}
      />
    </AppShell>
  );
}
