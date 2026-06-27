import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
})

export const DEFAULT_OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'

export function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY

  if (!key) {
    throw new Error(
      'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env.local',
    )
  }

  return key
}

export async function generateOpenRouterText(
  prompt: string,
  options?: {
    systemInstruction?: string
    model?: string
  },
): Promise<string> {
  const result = await generateText({
    model: openrouter(options?.model ?? DEFAULT_OPENROUTER_MODEL),
    prompt,
    system: options?.systemInstruction,
    maxOutputTokens: 2000,
    temperature: 0.2,
  })

  return result.text
}
