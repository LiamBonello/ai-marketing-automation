import { AppShell } from '@/components/layout/AppShell';
import { AssistantWorkspace } from '@/features/assistant/AssistantWorkspace';

export default function HomePage() {
  return (
    <AppShell>
      <AssistantWorkspace />
    </AppShell>
  );
}
