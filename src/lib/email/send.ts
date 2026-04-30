import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Resend } from 'resend';
import { env, isUsingLocalSmtp } from '../env';

// Fail-fast guard. In production runtime the app must use Resend; silently
// falling back to the local Mailpit transport would mean transactional mail
// goes nowhere. Crash at module load with a clear message so a
// misconfigured deploy is caught before the first password reset.
//
// Skipped during `next build` page collection (NEXT_PHASE) because that
// phase loads .env.local locally even though NODE_ENV=production. Real
// production deployments don't carry .env.local; the runtime check still
// fires there.
const isBuildPhase = process.env['NEXT_PHASE'] === 'phase-production-build';
if (!isBuildPhase && env.NODE_ENV === 'production' && !env.RESEND_API_KEY) {
  throw new Error(
    'RESEND_API_KEY is required when NODE_ENV=production. ' +
      'Set it in Vercel project env vars before deploying.',
  );
}

/**
 * Email sender abstraction.
 *
 * - Local dev (no RESEND_API_KEY): nodemailer → local Mailpit SMTP.
 * - Production (RESEND_API_KEY set): Resend's HTTP API.
 *
 * See docs/architecture/email-system.md.
 *
 * React Email's renderer is imported lazily so callers that don't actually
 * send mail don't pay the cost.
 */

export type SendEmailParams = {
  to: string;
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { render } = await import('@react-email/render');
  const html = await render(params.react);
  const text = await render(params.react, { plainText: true });

  if (isUsingLocalSmtp) {
    const transportOptions: SMTPTransport.Options = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
    };
    if (env.SMTP_USER && env.SMTP_PASS) {
      transportOptions.auth = { user: env.SMTP_USER, pass: env.SMTP_PASS };
    }
    const transport = nodemailer.createTransport(transportOptions);
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: params.to,
      subject: params.subject,
      html,
      text,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    });
    return;
  }

  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required when not using local SMTP');
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    html,
    text,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
  });
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}
