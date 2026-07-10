import { email as de } from '../locale/de.ts'

export interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html: string
  cc?: string
  bcc?: string
}

export type SendEmailFn = (options: SendEmailOptions) => Promise<unknown>

export function createSendEmail(transport: {
  sendMail: (opts: Record<string, unknown>) => Promise<unknown>
}): SendEmailFn {
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
  await sendEmail({
    to: user.email,
    subject: de.verification.subject,
    text: de.verification.text(user.name, verificationUrl),
    html: de.verification.html(user.name, verificationUrl),
  })
}

export async function sendPasswordResetEmail(
  sendEmail: SendEmailFn,
  user: { name: string; email: string },
  resetUrl: string,
): Promise<void> {
  await sendEmail({
    to: user.email,
    subject: de.passwordReset.subject,
    text: de.passwordReset.text(user.name, resetUrl),
    html: de.passwordReset.html(user.name, resetUrl),
  })
}

export async function sendAccountDeletionEmail(
  sendEmail: SendEmailFn,
  user: { name: string; email: string },
  initiatedBy: 'self' | 'admin',
): Promise<void> {
  let content = initiatedBy === 'admin' ? de.accountDeletion.admin : de.accountDeletion.self

  await sendEmail({
    to: user.email,
    subject: de.accountDeletion.subject,
    text: content.text(user.name),
    html: content.html(user.name),
  })
}
