import { getGeminiClient } from './client'
import { GEMINI_MODEL, LIGHT_GENERATION_CONFIG } from './config'

function extractText(
  interaction: Awaited<
    ReturnType<ReturnType<typeof getGeminiClient>['interactions']['create']>
  >,
): string {
  const parts: string[] = []

  for (const step of interaction.steps ?? []) {
    if (step.type !== 'model_output' || !step.content) continue
    for (const block of step.content) {
      if (block.type === 'text' && block.text) {
        parts.push(block.text)
      }
    }
  }

  return parts.join('\n').trim()
}

export async function generateGeminiText(
  input: string,
  options?: {
    systemInstruction?: string
    model?: string
  },
): Promise<string> {
  const ai = getGeminiClient()

  const interaction = await ai.interactions.create({
    model: options?.model ?? GEMINI_MODEL,
    input,
    system_instruction: options?.systemInstruction,
    generation_config: LIGHT_GENERATION_CONFIG,
  })

  return extractText(interaction)
}
