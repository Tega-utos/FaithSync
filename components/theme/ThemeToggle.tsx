'use client'

import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { Sun, Moon, Desktop } from '@phosphor-icons/react'

const THEMES = ['system', 'light', 'dark'] as const

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    // Render a placeholder with same dimensions to avoid layout shift
    return <div className={`w-8 h-8 rounded-full bg-transparent ${className}`} />
  }

  const currentIndex = THEMES.indexOf(theme as (typeof THEMES)[number])
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length]

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Desktop

  const label =
    theme === 'dark' ? 'Dark mode' : theme === 'light' ? 'Light mode' : 'System'

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className={`relative p-1.5 rounded-full transition-colors hover:bg-subtle text-text-secondary ${className}`}
      aria-label={`Theme: ${label}. Click for ${nextTheme}`}
      title={`${label} — click for ${nextTheme}`}
    >
      <Icon size={18} weight={theme === 'system' ? 'regular' : 'fill'} />
    </button>
  )
}
