import { existsSync, readFileSync } from 'node:fs';
import nodemailer from 'nodemailer';

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

function required(name) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('REPLACE_ME_')) {
    throw new Error(`${name} is not configured in .env.local`);
  }
  return value;
}

loadEnv('.env.local');
loadEnv('.env');

const sendTest = process.argv.includes('--send');

try {
  const host = required('SMTP_HOST');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = required('SMTP_USER');
  const password = required('SMTP_PASSWORD');
  const from = required('SMTP_FROM');

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
  });

  console.log('Checking Brevo SMTP...');
  console.log(`  Host: ${host}`);
  console.log(`  Port: ${port}`);
  console.log(`  Secure: ${secure}`);
  console.log(`  Login: ${user}`);

  await transport.verify();
  console.log('SMTP connection/authentication: OK');

  if (sendTest) {
    const to = required('SMTP_TEST_TO');
    const result = await transport.sendMail({
      from,
      to,
      subject: 'MarketPilot SMTP test',
      text: 'MarketPilot successfully sent this test email through Brevo SMTP.',
      html: '<p>MarketPilot successfully sent this test email through <strong>Brevo SMTP</strong>.</p>',
    });

    console.log('Test email: SENT');
    console.log(`  To: ${to}`);
    console.log(`  Message ID: ${result.messageId}`);
  }
} catch (error) {
  console.error(sendTest ? 'Brevo email test: FAILED' : 'Brevo SMTP check: FAILED');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
