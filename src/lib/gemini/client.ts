import { GoogleGenAI } from '@google/genai'

let client: GoogleGenAI | null = null

/** Resolve Gemini API key — NEXT_GEMINI_API_KEY is the preferred server-side key. */
export function getGeminiApiKey(): string {
  const key =
    process.env.NEXT_GEMINI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (!key) {
    throw new Error(
      'Gemini API key not configured. Set NEXT_GEMINI_API_KEY in .env.local',
    )
  }

  return key
}

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: getGeminiApiKey() })
  }
  return client
}

export function isQuotaError(err: unknown): boolean {
  const text =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : JSON.stringify(err)

  const lower = text.toLowerCase()
  return (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit')
  )
}
