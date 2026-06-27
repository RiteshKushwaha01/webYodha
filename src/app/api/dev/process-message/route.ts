import { NextResponse } from 'next/server'

import { runGeminiAgent } from '@/features/conversations/lib/gemini-agent'
import { api } from '../../../../../convex/_generated/api'
import { Id } from '../../../../../convex/_generated/dataModel'
import { convex } from '@/lib/convex-client'

/** Dev-only direct AI processing (no Inngest Dev Server required). */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const internalKey = process.env.WEBYODHA_CONVEX_INTERNAL_KEY
  const headerKey = request.headers.get('x-internal-key')

  if (!internalKey || headerKey !== internalKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { messageId, conversationId, projectId, message } = body as {
    messageId: Id<'messages'>
    conversationId: Id<'conversations'>
    projectId: Id<'projects'>
    message: string
  }

  const recent = await convex.query(api.system.getRecentMessages, {
    internalKey,
    conversationId,
    limit: 20,
  })
  const target = recent.find((m) => m._id === messageId)
  if (target && target.status !== 'processing') {
    return NextResponse.json({ skipped: true })
  }

  try {
    await new Promise((r) => setTimeout(r, 500))

    const response = await runGeminiAgent({
      messageId,
      conversationId,
      projectId,
      message,
      internalKey,
    })

    await convex.mutation(api.system.updateMessageContent, {
      internalKey,
      messageId,
      content: response,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const content =
      error instanceof Error
        ? `Sorry, I encountered an error: ${error.message}`
        : 'Sorry, I encountered an error while processing your request.'

    await convex.mutation(api.system.updateMessageContent, {
      internalKey,
      messageId,
      content,
    })

    return NextResponse.json({ error: content }, { status: 500 })
  }
}
