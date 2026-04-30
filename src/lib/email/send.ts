import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Resend } from 'resend';
import { env, isUsingLocalSmtp } from '../env';

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
