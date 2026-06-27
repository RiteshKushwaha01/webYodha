import { inngest } from '@/inngest/client'
import { Id } from '../../convex/_generated/dataModel'

interface MessageProcessingData {
  messageId: Id<'messages'>
  conversationId: Id<'conversations'>
  projectId: Id<'projects'>
  message: string
}

const getAppBaseUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000')

/**
 * Triggers AI processing.
 * - Production: Inngest Cloud
 * - Local dev (default): direct /api/dev/process-message (no Inngest Dev Server needed)
 * - Local dev with INNGEST_DEV=1: Inngest Dev Server
 */
export async function triggerMessageProcessing(
  data: MessageProcessingData,
): Promise<void> {
  const useInngest =
    process.env.NODE_ENV !== 'development' ||
    process.env.INNGEST_DEV === '1'

  if (useInngest) {
    await inngest.send({ name: 'message/sent', data })
    return
  }

  const internalKey = process.env.WEBYODHA_CONVEX_INTERNAL_KEY
  if (!internalKey) {
    throw new Error('WEBYODHA_CONVEX_INTERNAL_KEY is not configured')
  }

  const response = await fetch(`${getAppBaseUrl()}/api/dev/process-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': internalKey,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error ?? 'Failed to process message',
    )
  }
}
