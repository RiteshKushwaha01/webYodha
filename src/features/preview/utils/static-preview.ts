import { Doc, Id } from '../../../../convex/_generated/dataModel'
import { getFilePath } from './file-tree'

type FileDoc = Doc<'files'>

const HTML_ENTRY_NAMES = ['index.html', 'index.htm']

export const isStaticHtmlProject = (files: FileDoc[]): boolean => {
  const hasPackageJson = files.some(
    (f) => f.type === 'file' && f.name === 'package.json' && !f.storageId,
  )
  if (hasPackageJson) return false

  return files.some(
    (f) =>
      f.type === 'file' &&
      !f.storageId &&
      HTML_ENTRY_NAMES.includes(f.name.toLowerCase()),
  )
}

export const buildStaticHtmlPreview = (files: FileDoc[]): string | null => {
  const filesMap = new Map(files.map((f) => [f._id, f]))

  const htmlFile =
    files.find(
      (f) =>
        f.type === 'file' &&
        !f.storageId &&
        f.name.toLowerCase() === 'index.html',
    ) ??
    files.find(
      (f) =>
        f.type === 'file' &&
        !f.storageId &&
        f.name.toLowerCase() === 'index.htm',
    )

  if (!htmlFile?.content) return null

  let html = htmlFile.content
  const htmlDir = getFilePath(htmlFile, filesMap).replace(/\/[^/]+$/, '')

  const resolveProjectPath = (href: string): string | null => {
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('//') ||
      href.startsWith('data:') ||
      href.startsWith('#')
    ) {
      return null
    }

    const baseParts = htmlDir ? htmlDir.split('/') : []
    const hrefParts = href.split('/')

    for (const part of hrefParts) {
      if (part === '.' || part === '') continue
      if (part === '..') baseParts.pop()
      else baseParts.push(part)
    }

    return baseParts.join('/')
  }

  html = html.replace(
    /<link([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, _before, href, _after) => {
      const path = resolveProjectPath(href)
      if (!path) return match

      const cssFile = files.find(
        (f) =>
          f.type === 'file' &&
          !f.storageId &&
          getFilePath(f, filesMap) === path,
      )

      if (!cssFile?.content) return match
      return `<style data-inlined-from="${href}">\n${cssFile.content}\n</style>`
    },
  )

  html = html.replace(
    /<script([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, src, after) => {
      if (/type=["']module["']/i.test(before + after)) return match

      const path = resolveProjectPath(src)
      if (!path) return match

      const jsFile = files.find(
        (f) =>
          f.type === 'file' &&
          !f.storageId &&
          getFilePath(f, filesMap) === path,
      )

      if (!jsFile?.content) return match
      return `<script data-inlined-from="${src}">\n${jsFile.content}\n</script>`
    },
  )

  return html
}

export const createStaticPreviewUrl = (files: FileDoc[]): string | null => {
  const html = buildStaticHtmlPreview(files)
  if (!html) return null

  const blob = new Blob([html], { type: 'text/html' })
  return URL.createObjectURL(blob)
}
