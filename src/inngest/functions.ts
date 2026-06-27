import { inngest } from './client'
import { firecrawl } from '@/lib/firecrawl'
import { generateOpenRouterText } from '@/lib/ai'

const URL_REGEX = /https?:\/\/[^\s]+/g

export const demoGenerate = inngest.createFunction(
  { id: 'demo-generate', triggers: [{ event: 'demo/generate' }] },
  async ({ event, step }) => {
    const { prompt } = event.data as { prompt: string }

    const urls = (await step.run('exctract-urls', async () => {
      return prompt.match(URL_REGEX) ?? []
    })) as string[]

    const scrapedContent = await step.run('scrape-urls', async () => {
      const results = await Promise.all(
        urls.map(async (url) => {
          const result = await firecrawl.scrape(url, { formats: ['markdown'] })
          return result.markdown ?? null
        }),
      )
      return results.filter(Boolean).join('\n\n')
    })

    const finalPrompt = scrapedContent
      ? `Context:\n${scrapedContent}\n\nQuestion: ${prompt}`
      : prompt

    await step.run('generate-text', async () => {
      return await generateOpenRouterText(finalPrompt)
    })
  },
)

export const demoError = inngest.createFunction(
  { id: 'demo-error', triggers: [{ event: 'demo/error' }] },
  async ({ step }) => {
    await step.run('fail', async () => {
      throw new Error('Inngest error: Background job failed!')
    })
  },
)
