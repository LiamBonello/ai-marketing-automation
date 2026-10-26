import { AppShell } from '@/components/layout/AppShell';
import { AssistantWorkspace } from '@/features/assistant/AssistantWorkspace';
import { requirePageContext } from '@/lib/page-context';

export default async function HomePage() {
  const context = await requirePageContext();

  return (
    <AppShell
      identity={context.identity}
      demo={context.demo}
    >
      <AssistantWorkspace
        mode={context.demo ? 'demo' : 'live'}
        businessName={context.identity.businessName}
        creditBalance={context.identity.creditBalance}
      />
    </AppShell>
  );
}
