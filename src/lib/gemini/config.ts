// import type { Interactions } from '@google/genai'

// /** Default model from Google AI Studio — override with GEMINI_MODEL in .env.local */
// export const GEMINI_MODEL =
//   process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'

// export const DEFAULT_GENERATION_CONFIG: Interactions.GenerationConfig = {
//   temperature: 1,
//   max_output_tokens: 65536,
//   top_p: 0.95,
//   thinking_level: 'high',
// }

// export const TITLE_GENERATION_CONFIG: Interactions.GenerationConfig = {
//   temperature: 0,
//   max_output_tokens: 50,
// }

// export const LIGHT_GENERATION_CONFIG: Interactions.GenerationConfig = {
//   temperature: 0.3,
//   max_output_tokens: 4096,
// }

import type { Interactions } from '@google/genai'

/** Default model from Google AI Studio — override with GEMINI_MODEL in .env.local */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'

export const DEFAULT_GENERATION_CONFIG: Interactions.GenerationConfig = {
  temperature: 0.3,
  max_output_tokens: 8192,
  top_p: 0.95,
  thinking_level: 'medium',
}

export const TITLE_GENERATION_CONFIG: Interactions.GenerationConfig = {
  temperature: 0,
  max_output_tokens: 50,
}

export const LIGHT_GENERATION_CONFIG: Interactions.GenerationConfig = {
  temperature: 0.1,
  max_output_tokens: 1024,
}
