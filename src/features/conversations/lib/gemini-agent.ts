import type { Interactions } from '@google/genai'

import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'
import { convex } from '@/lib/convex-client'
import { getGeminiClient, isQuotaError } from '@/lib/gemini/client'
import {
  DEFAULT_GENERATION_CONFIG,
  GEMINI_MODEL,
  TITLE_GENERATION_CONFIG,
} from '@/lib/gemini/config'

import {
  CODING_AGENT_SYSTEM_PROMPT,
  TITLE_GENERATOR_SYSTEM_PROMPT,
} from '../inngest/constants'
import { DEFAULT_CONVERSATION_TITLE } from '../constants'
import { CODING_AGENT_TOOLS } from './agent-tool-declarations'
import { executeAgentTool } from './agent-tool-executors'
import { tryScaffoldFallback } from './scaffold-fallback'

export interface RunGeminiAgentParams {
  messageId: Id<'messages'>
  conversationId: Id<'conversations'>
  projectId: Id<'projects'>
  message: string
  internalKey: string
}

const MAX_TOOL_ITERATIONS = 16

const CUSTOM_TOOL_NAMES = new Set([
  'listFiles',
  'readFiles',
  'updateFile',
  'createFiles',
  'createFolder',
  'renameFile',
  'deleteFiles',
  'scrapeUrls',
])

function extractText(interaction: Interactions.Interaction): string {
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

function getFunctionCalls(
  interaction: Interactions.Interaction,
): Interactions.FunctionCallStep[] {
  return (
    interaction.steps?.filter(
      (step): step is Interactions.FunctionCallStep =>
        step.type === 'function_call' && CUSTOM_TOOL_NAMES.has(step.name),
    ) ?? []
  )
}

async function runToolLoop(
  message: string,
  systemPrompt: string,
  toolContext: { internalKey: string; projectId: Id<'projects'> },
): Promise<string> {
  const ai = getGeminiClient()

  let interaction = await ai.interactions.create({
    model: GEMINI_MODEL,
    input: message,
    system_instruction: systemPrompt,
    tools: CODING_AGENT_TOOLS,
    generation_config: DEFAULT_GENERATION_CONFIG,
  })

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const functionCalls = getFunctionCalls(interaction)

    if (functionCalls.length === 0) {
      break
    }

    const results: Interactions.FunctionResultStep[] = []

    for (const call of functionCalls) {
      const result = await executeAgentTool(
        call.name,
        (call.arguments ?? {}) as Record<string, unknown>,
        toolContext,
      )

      results.push({
        type: 'function_result',
        name: call.name,
        call_id: call.id,
        result,
      })
    }

    interaction = await ai.interactions.create({
      model: GEMINI_MODEL,
      previous_interaction_id: interaction.id,
      input: results,
      tools: CODING_AGENT_TOOLS,
      system_instruction: systemPrompt,
      generation_config: DEFAULT_GENERATION_CONFIG,
    })
  }

  return extractText(interaction)
}

export async function runGeminiAgent({
  messageId,
  conversationId,
  projectId,
  message,
  internalKey,
}: RunGeminiAgentParams): Promise<string> {
  const toolContext = { internalKey, projectId }

  const conversation = await convex.query(api.system.getConversationById, {
    internalKey,
    conversationId,
  })

  if (!conversation) {
    throw new Error('Conversation not found')
  }

  const recentMessages = await convex.query(api.system.getRecentMessages, {
    internalKey,
    conversationId,
    limit: 10,
  })

  let systemPrompt = CODING_AGENT_SYSTEM_PROMPT

  const contextMessages = recentMessages.filter(
    (msg) => msg._id !== messageId && msg.content.trim() !== '',
  )

  if (contextMessages.length > 0) {
    const historyText = contextMessages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n')

    systemPrompt += `\n\n## Previous Conversation (for context only - do NOT repeat these responses):\n${historyText}\n\n## Current Request:\nRespond ONLY to the user's new message below. Do not repeat or reference your previous responses.`
  }

  if (conversation.title === DEFAULT_CONVERSATION_TITLE) {
    try {
      const ai = getGeminiClient()
      const titleInteraction = await ai.interactions.create({
        model: GEMINI_MODEL,
        input: message,
        system_instruction: TITLE_GENERATOR_SYSTEM_PROMPT,
        generation_config: TITLE_GENERATION_CONFIG,
      })
      const title = extractText(titleInteraction)
      if (title) {
        await convex.mutation(api.system.updateConversationTitle, {
          internalKey,
          conversationId,
          title,
        })
      }
    } catch {
      // Title generation is optional
    }
  }

  const filesBefore = await convex.query(api.system.getProjectFiles, {
    internalKey,
    projectId,
  })

  try {
    const response = await runToolLoop(message, systemPrompt, toolContext)

    const filesAfter = await convex.query(api.system.getProjectFiles, {
      internalKey,
      projectId,
    })

    if (filesAfter.length <= filesBefore.length) {
      const scaffold = await tryScaffoldFallback({
        message,
        projectId,
        internalKey,
      })
      if (scaffold) return scaffold
    }

    return (
      response ||
      'I processed your request. Let me know if you need anything else!'
    )
  } catch (error) {
    if (isQuotaError(error)) {
      const scaffold = await tryScaffoldFallback({
        message,
        projectId,
        internalKey,
      })
      if (scaffold) return scaffold
    }

    throw error
  }
}
