import { useCallback, useEffect, useRef, useState } from 'react'
import { WebContainer } from '@webcontainer/api'

import { buildFileTree, getFilePath } from '@/features/preview/utils/file-tree'
import {
  createStaticPreviewUrl,
  isStaticHtmlProject,
} from '@/features/preview/utils/static-preview'
import { useFiles } from '@/features/projects/hooks/use-files'

import { api } from '../../../../convex/_generated/api'
import { Id } from '../../../../convex/_generated/dataModel'

// Singleton WebContainer instance
let webcontainerInstance: WebContainer | null = null
let bootPromise: Promise<WebContainer> | null = null

const getWebContainer = async (): Promise<WebContainer> => {
  if (webcontainerInstance) {
    return webcontainerInstance
  }

  if (!bootPromise) {
    bootPromise = WebContainer.boot({ coep: 'credentialless' })
  }

  webcontainerInstance = await bootPromise
  return webcontainerInstance
}

const teardownWebContainer = () => {
  if (webcontainerInstance) {
    webcontainerInstance.teardown()
    webcontainerInstance = null
  }
  bootPromise = null
}

interface UseWebContainerProps {
  projectId: Id<'projects'>
  enabled: boolean
  settings?: {
    installCommand?: string
    devCommand?: string
  }
}

const startStaticPreviewServer = async (
  container: WebContainer,
  appendOutput: (data: string) => void,
) => {
  const commands = [
    {
      command: 'python3',
      args: ['-m', 'http.server', '3000', '--bind', '0.0.0.0'],
    },
    {
      command: 'python',
      args: ['-m', 'http.server', '3000', '--bind', '0.0.0.0'],
    },
    {
      command: 'npx',
      args: ['--yes', 'http-server', '-p', '3000', '-a', '0.0.0.0'],
    },
    { command: 'busybox', args: ['httpd', '-f', '-p', '3000', '-h', '.'] },
  ]

  for (const candidate of commands) {
    try {
      const process = await container.spawn(candidate.command, candidate.args)
      process.output.pipeTo(
        new WritableStream({
          write(data) {
            appendOutput(data)
          },
        }),
      )
      return process
    } catch {
      // Try the next fallback command.
    }
  }

  return null
}

export const useWebContainer = ({
  projectId,
  enabled,
  settings,
}: UseWebContainerProps) => {
  const [status, setStatus] = useState<
    'idle' | 'booting' | 'installing' | 'running' | 'error'
  >('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restartKey, setRestartKey] = useState(0)
  const [terminalOutput, setTerminalOutput] = useState('')

  const containerRef = useRef<WebContainer | null>(null)
  const hasStartedRef = useRef(false)
  const staticUrlRef = useRef<string | null>(null)
  const previewModeRef = useRef<'webcontainer' | 'static-blob'>('webcontainer')

  const revokeStaticUrl = useCallback(() => {
    if (staticUrlRef.current) {
      URL.revokeObjectURL(staticUrlRef.current)
      staticUrlRef.current = null
    }
  }, [])

  // Fetch files from Convex (auto-updates on changes)
  const files = useFiles(projectId)

  // Initial boot and mount
  useEffect(() => {
    if (!enabled || !files || files.length === 0 || hasStartedRef.current) {
      return
    }

    hasStartedRef.current = true

    const start = async () => {
      try {
        setStatus('booting')
        setError(null)
        setTerminalOutput('')

        const appendOutput = (data: string) => {
          setTerminalOutput((prev) => prev + data)
        }

        const container = await getWebContainer()
        containerRef.current = container

        const fileTree = buildFileTree(files)
        await container.mount(fileTree)

        container.on('server-ready', (_port, url) => {
          setPreviewUrl(url)
          setStatus('running')
        })

        setStatus('installing')

        const hasHtmlEntry = isStaticHtmlProject(files)

        if (hasHtmlEntry) {
          const staticPreviewUrl = createStaticPreviewUrl(files)

          if (staticPreviewUrl) {
            staticUrlRef.current = staticPreviewUrl
            previewModeRef.current = 'static-blob'
            setPreviewUrl(staticPreviewUrl)
            setStatus('running')
            return
          }

          appendOutput(
            'Detected static HTML project. Starting simple preview server...\n',
          )
          const staticServer = await startStaticPreviewServer(
            container,
            appendOutput,
          )

          if (staticServer) {
            container.on('server-ready', (_port, url) => {
              setPreviewUrl(url)
              setStatus('running')
            })
            return
          }

          throw new Error(
            'Unable to start a preview server for the static HTML files.',
          )
        }

        // Parse install command (default: npm install)
        const installCmd = settings?.installCommand || 'npm install'
        const [installBin, ...installArgs] = installCmd.split(' ')
        appendOutput(`$ ${installCmd}\n`)
        const installProcess = await container.spawn(installBin, installArgs)
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data)
            },
          }),
        )
        const installExitCode = await installProcess.exit

        if (installExitCode !== 0) {
          throw new Error(`${installCmd} failed with code ${installExitCode}`)
        }

        // Parse dev command (default: npm run dev)
        const devCmd = settings?.devCommand || 'npm run dev'
        const [devBin, ...devArgs] = devCmd.split(' ')
        appendOutput(`\n$ ${devCmd}\n`)
        const devProcess = await container.spawn(devBin, devArgs)
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data)
            },
          }),
        )
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error')
        setStatus('error')
      }
    }

    start()
  }, [
    enabled,
    files,
    restartKey,
    settings?.devCommand,
    settings?.installCommand,
  ])

  // Sync file changes (hot-reload)
  useEffect(() => {
    if (!enabled || !files || status !== 'running') return

    if (previewModeRef.current === 'static-blob' && isStaticHtmlProject(files)) {
      revokeStaticUrl()
      const url = createStaticPreviewUrl(files)
      if (url) {
        staticUrlRef.current = url
        setPreviewUrl(url)
      }
      return
    }

    const container = containerRef.current
    if (!container) return

    const filesMap = new Map(files.map((f) => [f._id, f]))

    for (const file of files) {
      if (file.type !== 'file' || file.storageId || !file.content) continue

      const filePath = getFilePath(file, filesMap)
      container.fs.writeFile(filePath, file.content)
    }
  }, [enabled, files, revokeStaticUrl, status])

  useEffect(() => {
    return () => revokeStaticUrl()
  }, [revokeStaticUrl])

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      hasStartedRef.current = false
      previewModeRef.current = 'webcontainer'
      revokeStaticUrl()
      setStatus('idle')
      setPreviewUrl(null)
      setError(null)
    }
  }, [enabled, revokeStaticUrl])

  // Restart the entire WebContainer process
  const restart = useCallback(() => {
    teardownWebContainer()
    containerRef.current = null
    hasStartedRef.current = false
    previewModeRef.current = 'webcontainer'
    revokeStaticUrl()
    setStatus('idle')
    setPreviewUrl(null)
    setError(null)
    setRestartKey((k) => k + 1)
  }, [revokeStaticUrl])

  return {
    status,
    previewUrl,
    error,
    restart,
    terminalOutput,
  }
}
