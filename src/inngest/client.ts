import { Inngest } from 'inngest'
import { sentryMiddleware } from '@inngest/middleware-sentry'

// Read client key from environment (server-only). Try several common env names.
const clientKey =
  process.env.INNGEST_API_KEY ||
  process.env.INNGEST_CLIENT_KEY ||
  process.env.NEXT_PUBLIC_INNGEST_KEY ||
  process.env.NEXT_PUBLIC_INNGEST_API_KEY ||
  undefined

if (!clientKey && process.env.NODE_ENV === 'production') {
  // In production we expect a configured key — warn if missing.
  // eslint-disable-next-line no-console
  console.warn('INNGEST API key not configured. Events may be rejected.')
}

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'webYodha',
  clientKey,
  middleware: [sentryMiddleware()],
})
