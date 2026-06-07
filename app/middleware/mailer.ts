import { createTransport } from 'nodemailer'
import { createContextKey, type Middleware } from 'remix/router'

import { createSendEmail } from '../utils/send-email.ts'
import type { SendEmailFn } from '../utils/send-email.ts'

const MailerContext = createContextKey<SendEmailFn>()

let port = Number(process.env.SMTP_PORT) || 1025
let user = process.env.SMTP_USER
let pass = process.env.SMTP_PASSWORD

let transport =
  user && pass
    ? createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port,
        secure: port === 465,
        auth: { user, pass },
      })
    : createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port,
        secure: port === 465,
        ignoreTLS: true,
      })

export function mailer(): Middleware<{ key: typeof MailerContext; value: SendEmailFn; property: 'mailer' }> {
  let sendEmail = createSendEmail(transport)

  return async (context, next) => {
    context.set(MailerContext, sendEmail, { property: 'mailer' })
    return next()
  }
}
