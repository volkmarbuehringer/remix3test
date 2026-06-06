import type { Handle } from 'remix/ui'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { users } from '../../data/schema.ts'
import { Layout } from '../../ui/layout.tsx'
import { AuthShell } from '../../ui/auth-card.tsx'
import { bodyTextCss } from '../../ui/page-primitives.tsx'
import { createRateLimiter } from '../../utils/rate-limiter.ts'

const verifyLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 10 })

export async function verify(context: AppContext) {
  let ip = context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
  if (!verifyLimiter.attempt(ip)) {
    return context.render(<VerifyErrorPage title="Too many attempts" message="You have made too many verification attempts. Please try again later." />, { status: 429 })
  }
  let token = (context.params as Record<string, string>).token

  let user = await context.db.findOne(users, { where: { verification_token: token } })
  if (!user) {
    return context.render(<VerifyErrorPage title="Invalid verification link" message="This verification link is invalid or has already been used." />, { status: 400 })
  }

  if (user.verification_expires != null && user.verification_expires < Date.now()) {
    return context.render(<VerifyErrorPage title="Link expired" message="This verification link has expired. Please register again to receive a new link." />, { status: 400 })
  }

  await context.db.update(users, user.id, {
    email_verified: 1,
    verification_token: null as unknown as string,
    verification_expires: null as unknown as number,
  })

  let session = context.session
  if (session) {
    session.flash('verified', 'Email verified successfully! Please log in.')
  }

  return redirect(routes.auth.login.index.href())
}

function VerifyErrorPage(handle: Handle<{ title: string; message: string }>) {
  return () => (
    <Layout title="Verification">
      <AuthShell
        eyebrow="Verification"
        title={handle.props.title}
        description={handle.props.message}
      >
        <p mix={bodyTextCss}>
          <a href={routes.auth.login.index.href()}>Back to login</a>
        </p>
      </AuthShell>
    </Layout>
  )
}
