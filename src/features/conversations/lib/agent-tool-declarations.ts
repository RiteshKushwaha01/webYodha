import type { Interactions } from '@google/genai'

export const CODING_AGENT_TOOLS: Interactions.Tool[] = [
  {
    type: 'function',
    name: 'listFiles',
    description:
      'List all files and folders in the project. Returns names, IDs, types, and parentId for each item.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    type: 'function',
    name: 'readFiles',
    description: 'Read the content of files from the project.',
    parameters: {
      type: 'object',
      properties: {
        fileIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file IDs to read',
        },
      },
      required: ['fileIds'],
    },
  },
  {
    type: 'function',
    name: 'updateFile',
    description: 'Update the content of an existing file',
    parameters: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The ID of the file to update' },
        content: { type: 'string', description: 'The new content for the file' },
      },
      required: ['fileId', 'content'],
    },
  },
  {
    type: 'function',
    name: 'createFiles',
    description:
      'Create multiple files at once in the same folder. More efficient than creating files one by one.',
    parameters: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description:
            'The ID of the parent folder, or empty string for root level',
        },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['name', 'content'],
          },
        },
      },
      required: ['parentId', 'files'],
    },
  },
  {
    type: 'function',
    name: 'createFolder',
    description: 'Create a new folder in the project',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name of the folder to create' },
        parentId: {
          type: 'string',
          description:
            'The ID of the parent folder, or empty string for root level',
        },
      },
      required: ['name', 'parentId'],
    },
  },
  {
    type: 'function',
    name: 'renameFile',
    description: 'Rename a file or folder',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the file or folder to rename',
        },
        newName: { type: 'string', description: 'The new name' },
      },
      required: ['fileId', 'newName'],
    },
  },
  {
    type: 'function',
    name: 'deleteFiles',
    description:
      'Delete files or folders from the project. Deleting a folder removes all contents recursively.',
    parameters: {
      type: 'object',
      properties: {
        fileIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file or folder IDs to delete',
        },
      },
      required: ['fileIds'],
    },
  },
  {
    type: 'function',
    name: 'scrapeUrls',
    description:
      'Scrape content from URLs to get documentation or reference material.',
    parameters: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of URLs to scrape',
        },
      },
      required: ['urls'],
    },
  },
]
