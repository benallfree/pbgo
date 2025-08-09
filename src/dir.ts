import exitHook from 'exit-hook'
import { existsSync, mkdirSync, readdirSync, rmdirSync } from 'node:fs'
import path from 'node:path'
export { findAvailablePort } from './port'

// Track directories that were created by ensureDir
const createdDirectories = new Set<string>()

// Cleanup function to remove empty directories on exit
const cleanupEmptyDirectories = () => {
  for (const dirPath of createdDirectories) {
    try {
      if (existsSync(dirPath)) {
        const files = readdirSync(dirPath)
        if (files.length === 0) {
          rmdirSync(dirPath)
          //   console.log(`Removed empty directory: ${dirPath}`)
        }
      }
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }
}

// Register cleanup on process exit using exit-hook
exitHook(cleanupEmptyDirectories)

// Helper function to ensure directory exists
export const ensureDir = (dirPath: string, verbose: boolean = false): string => {
  const resolvedPath = path.resolve(dirPath)
  if (!existsSync(resolvedPath)) {
    try {
      mkdirSync(resolvedPath, { recursive: true })
      if (verbose) console.log(`Created directory: ${resolvedPath}`)
      // Track this directory for cleanup
      createdDirectories.add(resolvedPath)
    } catch (error) {
      console.error(`Failed to create directory ${resolvedPath}:`, (error as Error).message)
      process.exit(1)
    }
  }
  return resolvedPath
}
