import { NonRetriableError } from 'inngest'

import { inngest } from '@/inngest/client'
import { Id } from '../../../../convex/_generated/dataModel'
import { api } from '../../../../convex/_generated/api'
import { convex } from '@/lib/convex-client'
import { getGeminiApiKey } from '@/lib/gemini/client'
import { runGeminiAgent } from '../lib/gemini-agent'

interface MessageEvent {
  messageId: Id<'messages'>
  conversationId: Id<'conversations'>
  projectId: Id<'projects'>
  message: string
}

export const processMessage = inngest.createFunction(
  {
    id: 'process-message',
    triggers: [{ event: 'message/sent' }],
    cancelOn: [
      {
        event: 'message/cancel',
        if: 'event.data.messageId == async.data.messageId',
      },
    ],
    onFailure: async ({ event, step }) => {
      const { messageId } = event.data.event.data as MessageEvent
      const internalKey = process.env.WEBYODHA_CONVEX_INTERNAL_KEY

      if (internalKey) {
        await step.run('update-message-on-failure', async () => {
          await convex.mutation(api.system.updateMessageContent, {
            internalKey,
            messageId,
            content:
              'My apologies, I encountered an error while processing your request. Let me know if you need anything else!',
          })
        })
      }
    },
  },
  async ({ event, step }) => {
    const { messageId, conversationId, projectId, message } =
      event.data as MessageEvent

    const internalKey = process.env.WEBYODHA_CONVEX_INTERNAL_KEY

    try {
      getGeminiApiKey()
    } catch {
      throw new NonRetriableError(
        'Gemini API key is not configured. Set NEXT_GEMINI_API_KEY in .env.local',
      )
    }

    if (!internalKey) {
      throw new NonRetriableError(
        'WEBYODHA_CONVEX_INTERNAL_KEY is not configured',
      )
    }

    await step.sleep('wait-for-db-sync', '1s')

    const assistantResponse = await step.run('run-gemini-agent', async () => {
      return runGeminiAgent({
        messageId,
        conversationId,
        projectId,
        message,
        internalKey,
      })
    })

    await step.run('update-assistant-message', async () => {
      await convex.mutation(api.system.updateMessageContent, {
        internalKey,
        messageId,
        content: assistantResponse,
      })
    })

    return { success: true, messageId, conversationId }
  },
)
