import { z } from 'zod'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

import { generateGeminiText } from '@/lib/gemini/generate-text'
import { firecrawl } from '@/lib/firecrawl'

const quickEditSchema = z.object({
  editedCode: z.string(),
})

const URL_REGEX = /https?:\/\/[^\s)>\]]+/g

const QUICK_EDIT_PROMPT = `You are a code editing assistant. Edit the selected code based on the user's instruction.

<context>
<selected_code>
{selectedCode}
</selected_code>
<full_code_context>
{fullCode}
</full_code_context>
</context>

{documentation}

<instruction>
{instruction}
</instruction>

<instructions>
Return ONLY JSON: {"editedCode": "the edited version of the selected code"}
Maintain the same indentation level as the original.
Do not include any explanations or comments unless requested.
If the instruction is unclear or cannot be applied, return the original code unchanged.
</instructions>`

function parseJsonResponse<T>(text: string, schema: z.ZodType<T>): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in response')
  return schema.parse(JSON.parse(jsonMatch[0]))
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    const { selectedCode, fullCode, instruction } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 400 })
    }

    if (!selectedCode) {
      return NextResponse.json(
        { error: 'Selected code is required' },
        { status: 400 },
      )
    }

    if (!instruction) {
      return NextResponse.json(
        { error: 'Instruction is required' },
        { status: 400 },
      )
    }

    const urls: string[] = instruction.match(URL_REGEX) || []
    let documentationContext = ''

    if (urls.length > 0) {
      const scrapedResults = await Promise.all(
        urls.map(async (url) => {
          try {
            const result = await firecrawl.scrape(url, {
              formats: ['markdown'],
            })

            if (result.markdown) {
              return `<doc url="${url}">\n${result.markdown}\n</doc>`
            }

            return null
          } catch {
            return null
          }
        }),
      )

      const validResults = scrapedResults.filter(Boolean)

      if (validResults.length > 0) {
        documentationContext = `<documentation>\n${validResults.join('\n\n')}\n</documentation>`
      }
    }

    const prompt = QUICK_EDIT_PROMPT.replace('{selectedCode}', selectedCode)
      .replace('{fullCode}', fullCode || '')
      .replace('{instruction}', instruction)
      .replace('{documentation}', documentationContext)

    const text = await generateGeminiText(prompt)
    const output = parseJsonResponse(text, quickEditSchema)

    return NextResponse.json({ editedCode: output.editedCode })
  } catch (error) {
    console.error('Edit error:', error)
    return NextResponse.json(
      { error: 'Failed to generate edit' },
      { status: 500 },
    )
  }
}
