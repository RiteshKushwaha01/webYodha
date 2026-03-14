// POST localhost:3000/demo
'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function DemoPage() {
  const [loading, setLoading] = useState(false)
  const [loading2, setLoading2] = useState(false)
  const handleBlocking = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/demo/blocking', { method: 'POST' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(
          `Request failed (${res.status} ${res.statusText})${data ? `: ${JSON.stringify(data)}` : ''}`
        )
      }

      console.log('API response:', data)
    } finally {
      setLoading(false)
    }
  }

  const handleBackground = async () => {
    setLoading2(true)
    await fetch("/api/demo/background", { method: "POST" }) 
    setLoading2(false)
  }

  return (
    <div className="p-8 space-x-4">
      <Button disabled={loading} onClick={handleBlocking}>
        {loading ? 'Loading..' : 'Blocking'}
      </Button>
      <Button disabled={loading} onClick={handleBackground}>
        {loading2 ? 'Loading..' : 'Background'}
      </Button>
    </div>
  )
}
