import { firecrawl } from '@/lib/firecrawl'
import { convex } from '@/lib/convex-client'

import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'

export interface ToolContext {
  internalKey: string
  projectId: Id<'projects'>
}

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const { internalKey, projectId } = ctx

  switch (name) {
    case 'listFiles': {
      const files = await convex.query(api.system.getProjectFiles, {
        internalKey,
        projectId,
      })

      const sorted = files.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      return JSON.stringify(
        sorted.map((f) => ({
          id: f._id,
          name: f.name,
          type: f.type,
          parentId: f.parentId ?? null,
        })),
      )
    }

    case 'readFiles': {
      const fileIds = args.fileIds as string[] | undefined
      if (!fileIds?.length) return 'Error: fileIds array is required'

      const results: { id: string; name: string; content: string }[] = []

      for (const fileId of fileIds) {
        const file = await convex.query(api.system.getFileById, {
          internalKey,
          fileId: fileId as Id<'files'>,
        })
        if (file?.content) {
          results.push({ id: file._id, name: file.name, content: file.content })
        }
      }

      if (results.length === 0) {
        return 'Error: No files found with provided IDs. Use listFiles first.'
      }

      return JSON.stringify(results)
    }

    case 'updateFile': {
      const fileId = args.fileId as string | undefined
      const content = args.content as string | undefined
      if (!fileId) return 'Error: fileId is required'

      const file = await convex.query(api.system.getFileById, {
        internalKey,
        fileId: fileId as Id<'files'>,
      })

      if (!file) return `Error: File "${fileId}" not found`
      if (file.type === 'folder') return 'Error: Cannot update folder content'

      await convex.mutation(api.system.updateFile, {
        internalKey,
        fileId: fileId as Id<'files'>,
        content: content ?? '',
      })

      return `File "${file.name}" updated successfully`
    }

    case 'createFiles': {
      const parentId = (args.parentId as string) ?? ''
      const files = args.files as { name: string; content: string }[] | undefined
      if (!files?.length) return 'Error: files array is required'

      let resolvedParentId: Id<'files'> | undefined

      if (parentId) {
        const parentFolder = await convex.query(api.system.getFileById, {
          internalKey,
          fileId: parentId as Id<'files'>,
        })
        if (!parentFolder) {
          return `Error: Parent folder "${parentId}" not found`
        }
        if (parentFolder.type !== 'folder') {
          return `Error: "${parentId}" is not a folder`
        }
        resolvedParentId = parentId as Id<'files'>
      }

      const results = await convex.mutation(api.system.createFiles, {
        internalKey,
        projectId,
        parentId: resolvedParentId,
        files,
      })

      const created = results.filter((r) => !r.error)
      const failed = results.filter((r) => r.error)

      let response = `Created ${created.length} file(s)`
      if (created.length > 0) {
        response += `: ${created.map((r) => r.name).join(', ')}`
      }
      if (failed.length > 0) {
        response += `. Failed: ${failed.map((r) => `${r.name} (${r.error})`).join(', ')}`
      }

      return response
    }

    case 'createFolder': {
      const name = args.name as string | undefined
      const parentId = (args.parentId as string) ?? ''
      if (!name) return 'Error: name is required'

      if (parentId) {
        const parentFolder = await convex.query(api.system.getFileById, {
          internalKey,
          fileId: parentId as Id<'files'>,
        })
        if (!parentFolder) {
          return `Error: Parent folder "${parentId}" not found`
        }
        if (parentFolder.type !== 'folder') {
          return `Error: "${parentId}" is not a folder`
        }
      }

      const folderId = await convex.mutation(api.system.createFolder, {
        internalKey,
        projectId,
        name,
        parentId: parentId ? (parentId as Id<'files'>) : undefined,
      })

      return `Folder created with ID: ${folderId}`
    }

    case 'renameFile': {
      const fileId = args.fileId as string | undefined
      const newName = args.newName as string | undefined
      if (!fileId || !newName) return 'Error: fileId and newName are required'

      const file = await convex.query(api.system.getFileById, {
        internalKey,
        fileId: fileId as Id<'files'>,
      })
      if (!file) return `Error: File "${fileId}" not found`

      await convex.mutation(api.system.renameFile, {
        internalKey,
        fileId: fileId as Id<'files'>,
        newName,
      })

      return `Renamed "${file.name}" to "${newName}" successfully`
    }

    case 'deleteFiles': {
      const fileIds = args.fileIds as string[] | undefined
      if (!fileIds?.length) return 'Error: fileIds array is required'

      const results: string[] = []

      for (const fileId of fileIds) {
        const file = await convex.query(api.system.getFileById, {
          internalKey,
          fileId: fileId as Id<'files'>,
        })
        if (!file) {
          return `Error: File "${fileId}" not found`
        }

        await convex.mutation(api.system.deleteFile, {
          internalKey,
          fileId: fileId as Id<'files'>,
        })

        results.push(`Deleted ${file.type} "${file.name}" successfully`)
      }

      return results.join('\n')
    }

    case 'scrapeUrls': {
      const urls = args.urls as string[] | undefined
      if (!urls?.length) return 'Error: urls array is required'

      const results: { url: string; content: string }[] = []

      for (const url of urls) {
        try {
          const result = await firecrawl.scrape(url, { formats: ['markdown'] })
          if (result.markdown) {
            results.push({ url, content: result.markdown })
          }
        } catch {
          results.push({ url, content: `Failed to scrape URL: ${url}` })
        }
      }

      return results.length > 0
        ? JSON.stringify(results)
        : 'No content could be scraped from the provided URLs.'
    }

    default:
      return `Error: Unknown tool "${name}"`
  }
}
