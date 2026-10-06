import { createTransport } from 'nodemailer'
import { createContextKey, type Middleware } from 'remix/router'

import { createSendEmail } from '../utils/send-email.ts'
import type { SendEmailFn } from '../utils/send-email.ts'
import { envPositiveNumber, envString } from '../config.ts'

const MailerContext = createContextKey<SendEmailFn>()

const port = envPositiveNumber('SMTP_PORT', 1025)
const user = envString('SMTP_USER')
const pass = envString('SMTP_PASSWORD')

const transport =
  user && pass
    ? createTransport({
        host: envString('SMTP_HOST') ?? 'localhost',
        port,
        secure: port === 465,
        auth: { user, pass },
      })
    : createTransport({
        host: envString('SMTP_HOST') ?? 'localhost',
        port,
        secure: port === 465,
        ignoreTLS: true,
      })

export function mailer(): Middleware<{
  key: typeof MailerContext
  value: SendEmailFn
  property: 'mailer'
}> {
  let sendEmail = createSendEmail(transport)

  return async (context, next) => {
    context.set(MailerContext, sendEmail, { property: 'mailer' })
    return next()
  }
}
