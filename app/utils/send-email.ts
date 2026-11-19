import { email as de } from '../locale/de.ts'
import { envString } from '../config.ts'

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
  let from = envString('SMTP_FROM') ?? 'noreply@localhost'

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

/**
 * M5: sent to the owner of an email that already has an account when someone
 * tries to register with it again. The registration response itself stays
 * generic (identical to a successful sign-up) so it cannot be used to enumerate
 * accounts; this notice is the only signal, and it goes to the address owner.
 */
export async function sendAlreadyRegisteredEmail(
  sendEmail: SendEmailFn,
  user: { name: string; email: string },
): Promise<void> {
  await sendEmail({
    to: user.email,
    subject: de.alreadyRegistered.subject,
    text: de.alreadyRegistered.text(user.name),
    html: de.alreadyRegistered.html(user.name),
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
