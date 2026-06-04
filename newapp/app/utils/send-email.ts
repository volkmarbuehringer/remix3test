import { html } from 'remix/html-template'

export interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html: string
  cc?: string
  bcc?: string
}

export type SendEmailFn = (options: SendEmailOptions) => Promise<unknown>

export function createSendEmail(transport: { sendMail: (opts: Record<string, unknown>) => Promise<unknown> }): SendEmailFn {
  let from = process.env.SMTP_FROM || 'noreply@localhost'

  return async (options) =>
    transport.sendMail({
      from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })
}

export async function sendVerificationEmail(
  sendEmail: SendEmailFn,
  user: { name: string; email: string },
  verificationUrl: string,
): Promise<void> {
  let subject = 'Verify your email address'

  let htmlBody = String(html`
    <h1>Verify your email address</h1>
    <p>Hi ${user.name},</p>
    <p>Thanks for creating an account! Please verify your email address by clicking the link below:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p>This link will expire in 24 hours.</p>
    <p>If you didn't create this account, you can safely ignore this email.</p>
  `)

  let textBody = [
    'Verify your email address',
    '',
    `Hi ${user.name},`,
    '',
    'Thanks for creating an account! Please verify your email address by visiting:',
    '',
    verificationUrl,
    '',
    'This link will expire in 24 hours.',
    '',
    "If you didn't create this account, you can safely ignore this email.",
  ].join('\n')

  await sendEmail({
    to: user.email,
    subject,
    text: textBody,
    html: htmlBody,
  })
}
