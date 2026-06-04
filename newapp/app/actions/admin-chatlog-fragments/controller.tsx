import { createController } from 'remix/router'
import { adminRoutes as routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { getConversation } from '../../lib/chatlog.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'
import { ChatlogDetailFragment } from '../../ui/admin-fragments/chatlog-detail-fragment.tsx'

/**
 * Controller for admin chatlog fragment endpoints used by client-mounted frames.
 */
export default createController<typeof routes.admin.chatlog.fragments, AppContext>(
  routes.admin.chatlog.fragments,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async detail(context) {
        let conversationId = context.params.id

        if (!conversationId) {
          return context.render(
            <ChatlogDetailFragment conversationId="" messages={[]} error="No conversation ID provided" />,
            fragmentResponseInit(),
          )
        }

        let chat = await getConversation(conversationId)

        if (!chat) {
          return context.render(
            <ChatlogDetailFragment conversationId={conversationId} messages={[]} error="Conversation not found" />,
            fragmentResponseInit(),
          )
        }

        return context.render(
          <ChatlogDetailFragment
            conversationId={chat.id}
            messages={chat.conversation}
          />,
          fragmentResponseInit(),
        )
      },
    },
  },
)
