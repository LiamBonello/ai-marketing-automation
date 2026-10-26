import { Container, Divider, Stack, Typography } from '@mui/material';

const entity = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME || 'MarketPilot';
const contact = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || 'the support contact identified in your account or subscription documents';

export default function PrivacyPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 5, md: 9 } }}>
      <Stack spacing={3}>
        <Typography variant="h2">Privacy Notice</Typography>
        <Typography color="text.secondary">Last updated: 26 October 2026</Typography>
        <Divider />
        <Typography>This notice explains how {entity} processes personal data when you use MarketPilot. It is a launch template and should be reviewed against the operator's final legal entity, processors, hosting locations, retention schedule, and jurisdiction before public launch.</Typography>
        <Typography variant="h5">Data we process</Typography>
        <Typography>We process account and security records, business profiles, campaign content, connected-account identifiers and authorization tokens, consented email-contact data supplied by customers, billing identifiers, usage and audit records, and campaign performance data returned by connected platforms. Payment card details are handled by the payment provider and are not stored by MarketPilot.</Typography>
        <Typography variant="h5">Purposes and lawful basis</Typography>
        <Typography>Data is used to provide and secure the service, generate and schedule marketing content, publish approved campaigns, manage subscriptions and credits, provide support, maintain audit records, comply with law, and improve reliability. Customers remain responsible for ensuring that marketing contacts and instructions they provide have an appropriate lawful basis.</Typography>
        <Typography variant="h5">Processors and connected services</Typography>
        <Typography>Depending on configuration, data may be processed by infrastructure and storage providers, OpenAI for requested AI generation, Stripe for billing, email-delivery infrastructure, and social platforms explicitly connected by the customer, including Meta/Instagram, X, and TikTok. Each connected platform also processes information under its own terms and privacy notice.</Typography>
        <Typography variant="h5">Security, transfers, and retention</Typography>
        <Typography>MarketPilot uses server-side sessions, encrypted social-access tokens, access controls, audit records, and transport security. Some processors may operate internationally and appropriate transfer mechanisms should be maintained where required. Data should be retained only for service delivery, contractual, security, dispute, and legal requirements. Connected-account tokens are removed when a connection is disconnected.</Typography>
        <Typography variant="h5">Your rights</Typography>
        <Typography>Subject to applicable law, individuals may have rights to access, correct, delete, restrict or object to processing, receive portable data, and complain to a supervisory authority. Marketing recipients can unsubscribe through the link included in each email. Requests may be sent to {contact}.</Typography>
        <Typography variant="h5">Contact</Typography>
        <Typography>The data controller is {entity}. Privacy questions and rights requests may be directed to {contact}.</Typography>
      </Stack>
    </Container>
  );
}
