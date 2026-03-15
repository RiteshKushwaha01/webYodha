// POST localhost:3000/demo
'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { useAuth } from '@clerk/nextjs'

export default function DemoPage() {
  const { userId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loading2, setLoading2] = useState(false)
  const handleBlocking = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/demo/blocking', { method: 'POST' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(
          `Request failed (${res.status} ${res.statusText})${data ? `: ${JSON.stringify(data)}` : ''}`,
        )
      }

      console.log('API response:', data)
    } finally {
      setLoading(false)
    }
  }

  const handleBackground = async () => {
    setLoading2(true)
    await fetch('/api/demo/background', { method: 'POST' })
    setLoading2(false)
  }

  // 1) Client error - throws in the browser
  const handleClientError = () => {
    Sentry.logger.info('User attempting to click on client function', {
      userId,
    })
    throw new Error('Client error: Something went wrong in the browser!')
  }

  // 2) API error - triggers server-side error
  const handleApiError = async () => {
    await fetch('/api/demo/error', { method: 'POST' })
  }

  // 3) Inngest error - triggers error in background job
  const handleInngestError = async () => {
    await fetch('/api/demo/inngest-error', { method: 'POST' })
  }

  return (
    <div className="p-8 space-x-4">
      <Button disabled={loading} onClick={handleBlocking}>
        {loading ? 'Loading..' : 'Blocking'}
      </Button>
      <Button disabled={loading} onClick={handleBackground}>
        {loading2 ? 'Loading..' : 'Background'}
      </Button>

      <Button variant="destructive" onClick={handleClientError}>
        Client Error
      </Button>
      <Button variant="destructive" onClick={handleApiError}>
        API Error
      </Button>
      <Button variant="destructive" onClick={handleInngestError}>
        Inngest Error
      </Button>
    </div>
  )
}
