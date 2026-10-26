import { Container, Divider, Stack, Typography } from '@mui/material';

const entity = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || 'MarketPilot';

export default function TermsPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 5, md: 9 } }}>
      <Stack spacing={3}>
        <Typography variant="h2">Terms of Service</Typography>
        <Typography color="text.secondary">Last updated: 26 October 2026</Typography>
        <Divider />
        <Typography>These terms govern use of MarketPilot, operated by {entity}. They are a launch template and require jurisdiction-specific legal review before commercial launch.</Typography>
        <Typography variant="h5">The service</Typography>
        <Typography>MarketPilot helps users create, revise, schedule, and publish marketing content to services they connect. AI output is assistive and may contain errors. Users must review campaigns before approval and remain responsible for the accuracy, legality, rights, disclosures, offers, claims, audiences, and marketing instructions they submit.</Typography>
        <Typography variant="h5">Accounts and connected platforms</Typography>
        <Typography>You must provide accurate account information, protect credentials, and connect only accounts you are authorized to control. Platform availability, permissions, review, quotas, moderation, and API behavior are controlled by the relevant third-party platform. MarketPilot does not guarantee that a platform will accept or publish a post.</Typography>
        <Typography variant="h5">Marketing contacts</Typography>
        <Typography>You may upload email contacts only where you have a lawful basis to send the intended marketing. You are responsible for consent evidence, required notices, suppression obligations, and compliance with applicable direct-marketing rules. MarketPilot provides unsubscribe functionality but does not determine your lawful basis.</Typography>
        <Typography variant="h5">Subscriptions, credits, and advertising spend</Typography>
        <Typography>Subscriptions and credit purchases are charged through the configured payment provider. AI credits are service-usage units and are not money or stored value. Advertising spend, if paid-ad features are introduced, is paid directly to the advertising platform unless separate managed-service terms expressly state otherwise. MarketPilot does not currently collect or custody third-party advertising budgets.</Typography>
        <Typography variant="h5">Acceptable use and intellectual property</Typography>
        <Typography>You must not use MarketPilot for unlawful, deceptive, infringing, abusive, malicious, unauthorized, or unsolicited marketing activity or to violate connected-platform policies. You retain rights you hold in submitted material and grant the operator the limited rights needed to process it to provide the service. You are responsible for confirming rights in assets you upload or publish.</Typography>
        <Typography variant="h5">Availability and liability</Typography>
        <Typography>The service depends on third-party APIs and does not warrant marketing results, uninterrupted publication, platform approval, or error-free AI output. Any limitation of liability, warranty disclaimer, governing law, dispute mechanism, refund policy, and mandatory consumer terms should be finalized by counsel for the operator's jurisdiction and customer base.</Typography>
        <Typography variant="h5">Changes and termination</Typography>
        <Typography>Features and these terms may change as the service develops. Users may stop using the service and manage subscriptions through available billing controls. The operator may suspend access for material breach, security risk, non-payment, or unlawful use, subject to applicable law.</Typography>
      </Stack>
    </Container>
  );
}
