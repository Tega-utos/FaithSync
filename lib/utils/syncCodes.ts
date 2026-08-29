/**
 * FaithSync Standard Sync Code Utilities
 * Unambiguous alphabet (no 0/O, 1/I/L) with standard normalization and sharing
 */

export const UNAMBIGUOUS_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Standardize and normalize any user-entered buddy or group sync code
 * Trims leading/trailing whitespace and converts to uppercase
 */
export function normalizeCode(input: string | null | undefined): string {
  if (!input) return ''
  return input.trim().toUpperCase()
}

/**
 * Robust cross-platform copy & share helper
 * Uses Web Share API on mobile devices where available, falling back to navigator.clipboard
 */
export async function shareOrCopyCode({
  code,
  title = 'FaithSync Code',
  text = `Join me on FaithSync with code: ${code}`,
  url,
}: {
  code: string
  title?: string
  text?: string
  url?: string
}): Promise<{ copied: boolean; shared: boolean }> {
  const normalized = normalizeCode(code)
  const fullUrl = url || (typeof window !== 'undefined' ? `${window.location.origin}/welcome?ref=${normalized}` : '')
  const shareText = `${text} ${fullUrl}`.trim()

  // 1. Try Web Share API (native sheet on iOS / Android)
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ title, text: shareText })) {
    try {
      await navigator.share({
        title,
        text: shareText,
        url: fullUrl,
      })
      return { copied: true, shared: true }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { copied: false, shared: false }
      }
    }
  }

  // 2. Fallback to native clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(normalized)
      return { copied: true, shared: false }
    } catch {
      // Fallback
    }
  }

  return { copied: false, shared: false }
}

/**
 * Unambiguous client-side fallback generator for offline scenarios
 */
export function generateUnambiguousCode(length = 6, prefix = ''): string {
  let result = prefix
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length)
    result += UNAMBIGUOUS_CHARS[randomIndex]
  }
  return result
}
