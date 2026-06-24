import { useCallback, useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";

import {
  buildFileTree,
  getFilePath
} from "@/features/preview/utils/file-tree";
import { useFiles } from "@/features/projects/hooks/use-files";

import { Id } from "../../../../convex/_generated/dataModel";

// Singleton WebContainer instance
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

const getWebContainer = async (): Promise<WebContainer> => {
  if (webcontainerInstance) {
    return webcontainerInstance;
  }

  if (!bootPromise) {
    bootPromise = WebContainer.boot({ coep: "credentialless" });
  }

  webcontainerInstance = await bootPromise;
  return webcontainerInstance;
};

const teardownWebContainer = () => {
  if (webcontainerInstance) {
    webcontainerInstance.teardown();
    webcontainerInstance = null;
  }
  bootPromise = null;
};

interface UseWebContainerProps {
  projectId: Id<"projects">;
  enabled: boolean;
  settings?: {
    installCommand?: string;
    devCommand?: string;
  };
};

export const useWebContainer = ({
  projectId,
  enabled,
  settings,
}: UseWebContainerProps) => {
  const [status, setStatus] = useState<
    "idle" | "booting" | "installing" | "running" | "error"
  >("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [terminalOutput, setTerminalOutput] = useState("");

  const containerRef = useRef<WebContainer | null>(null);
  const hasStartedRef = useRef(false);

  // Sync file changes (hot-reload)
  const syncedFilesRef = useRef<Set<string>>(new Set());

  // Track file count to detect when to restart for new files during boot
  const filesCountRef = useRef(0);

  // Fetch files from Convex (auto-updates on changes)
  const files = useFiles(projectId);

  // Initial boot and mount - start when files become available
  useEffect(() => {
    if (!enabled || !files || files.length === 0) {
      return;
    }

    // Track file count changes
    const prevCount = filesCountRef.current;
    filesCountRef.current = files.length;

    // If already running and file count increased significantly, restart
    if (hasStartedRef.current && status === "running") {
      if (files.length > prevCount + 2) {
        // Significant new files - restart to remount fresh
        teardownWebContainer();
        containerRef.current = null;
        hasStartedRef.current = false;
        syncedFilesRef.current.clear();
        setStatus("idle");
        setPreviewUrl(null);
      }
      return;
    }

    // Skip if already started
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    const start = async () => {
      try {
        setStatus("booting");
        setError(null);
        setTerminalOutput("");

        const appendOutput = (data: string) => {
          setTerminalOutput((prev) => prev + data);
        };

        const container = await getWebContainer();
        containerRef.current = container;

        const fileTree = buildFileTree(files);
        await container.mount(fileTree);

        container.on("server-ready", (_port, url) => {
          setPreviewUrl(url);
          setStatus("running");
        });

        setStatus("installing");

        // Check if this is a Node.js project with package.json
        const hasPackageJson = files.some(
          (f) => f.name === "package.json" && !f.parentId
        );

        if (!hasPackageJson) {
          // For static sites without package.json, just show the files
          setStatus("running");
          appendOutput("No package.json found. Running in static mode.\n");
          return;
        }

        // Parse install command (default: npm install)
        const installCmd = settings?.installCommand || "npm install";
        const [installBin, ...installArgs] = installCmd.split(" ");
        appendOutput(`$ ${installCmd}\n`);
        const installProcess = await container.spawn(installBin, installArgs);
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          })
        );
        const installExitCode = await installProcess.exit;

        if (installExitCode !== 0) {
          throw new Error(`${installCmd} failed with code ${installExitCode}`);
        }

        // Parse dev command (default: npm run dev)
        const devCmd = settings?.devCommand || "npm run dev";
        const [devBin, ...devArgs] = devCmd.split(" ");
        appendOutput(`\n$ ${devCmd}\n`);
        const devProcess = await container.spawn(devBin, devArgs);
        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              appendOutput(data);
            },
          })
        );
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unknown error");
        setStatus("error");
      }
    };

    start();
  }, [enabled, files, restartKey, settings?.devCommand, settings?.installCommand, status]);

  // Sync file changes (hot-reload)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !files) return;

    // Only sync after container is ready, but allow sync anytime after boot
    if (status !== "running" && status !== "installing") return;

    const filesMap = new Map(files.map((f) => [f._id, f]));
    const currentFileIds = new Set<string>();

    for (const file of files) {
      if (file.type !== "file" || file.storageId || !file.content) continue;

      currentFileIds.add(file._id);
      const filePath = getFilePath(file, filesMap);

      // Only write if file is new or changed (compare content hash)
      if (!syncedFilesRef.current.has(file._id)) {
        container.fs.writeFile(filePath, file.content);
        syncedFilesRef.current.add(file._id);
      }
    }

    // Clean up stale tracked files
    for (const id of syncedFilesRef.current) {
      if (!currentFileIds.has(id)) {
        syncedFilesRef.current.delete(id);
      }
    }
  }, [files, status]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      hasStartedRef.current = false;
      syncedFilesRef.current.clear();
      setStatus("idle");
      setPreviewUrl(null);
      setError(null);
    }
  }, [enabled]);

  // Restart the entire WebContainer process
  const restart = useCallback(() => {
    teardownWebContainer();
    containerRef.current = null;
    hasStartedRef.current = false;
    syncedFilesRef.current.clear();
    setStatus("idle");
    setPreviewUrl(null);
    setError(null);
    setRestartKey((k) => k + 1);
  }, []);

  return {
    status,
    previewUrl,
    error,
    restart,
    terminalOutput,
  };
};
