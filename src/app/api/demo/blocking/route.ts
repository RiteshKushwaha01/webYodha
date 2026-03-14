// POST localhost:3000/api/demo/blocking
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'

export async function GET() {
  return Response.json(
    {
      ok: true,
      message:
        'This endpoint supports POST. You opened it in the browser (GET), so here is a friendly response. Use POST /api/demo/blocking to run the demo.',
    },
    { status: 200 }
  )
}

export async function POST() {
  const response = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: 'Write a vegetarian lasagna recipe for 4 people.',
  })

  return Response.json({ response })
}
