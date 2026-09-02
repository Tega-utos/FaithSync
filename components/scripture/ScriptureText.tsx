'use client'

import React, { useState, useEffect } from 'react'
import { BookOpen, CircleNotch } from '@phosphor-icons/react'
import { getVerse, BIBLE_VERSIONS } from '@/lib/scripture'

export interface ScriptureTextProps {
  reference: string
  versionId?: string
  display?: 'verseOnly' | 'verseWithReference' | 'card'
  initialText?: string
  className?: string
}

export function ScriptureText({
  reference,
  versionId = 'web',
  display = 'verseWithReference',
  initialText,
  className = '',
}: ScriptureTextProps) {
  const [text, setText] = useState<string>(initialText || '')
  const [loading, setLoading] = useState<boolean>(!initialText)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    if (initialText) {
      setText(initialText)
      setLoading(false)
      return
    }

    if (!reference) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    getVerse(reference, versionId)
      .then((res) => {
        if (isMounted) {
          setText(res.text)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load verse')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [reference, versionId, initialText])

  const versionObj = BIBLE_VERSIONS.find((v) => v.id === versionId)
  const versionShort = versionObj?.shortName || versionId.toUpperCase()

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-text-secondary py-2 ${className}`}>
        <CircleNotch size={14} className="animate-spin text-[#FBBF24]" />
        <span>Loading {reference}...</span>
      </div>
    )
  }

  if (error || !text) {
    return (
      <div className={`text-xs text-rose-500 italic py-1 ${className}`}>
        {error || `Unable to load ${reference}`}
      </div>
    )
  }

  // 1. verseOnly: just the verse text without citation
  if (display === 'verseOnly') {
    return (
      <div className={`text-sm text-text-primary leading-relaxed italic ${className}`}>
        &ldquo;{text}&rdquo;
      </div>
    )
  }

  // 2. card: Bordered, elevated card with Phosphor BookOpen icon and translation badge
  if (display === 'card') {
    return (
      <div
        className={`p-4 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/30 shadow-xs space-y-2.5 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#FBBF24]">
            <BookOpen size={16} weight="fill" />
            <span>{reference}</span>
          </div>
          <span className="text-[10px] font-bold font-mono text-text-secondary uppercase bg-card px-2 py-0.5 rounded-md border border-border">
            {versionShort}
          </span>
        </div>

        <p className="text-xs text-text-primary leading-relaxed italic">
          &ldquo;{text}&rdquo;
        </p>
      </div>
    )
  }

  // 3. verseWithReference: Text + citation line (Default)
  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-xs text-text-primary leading-relaxed italic">
        &ldquo;{text}&rdquo;
      </p>
      <p className="text-[11px] font-bold text-text-secondary flex items-center gap-1">
        <span>— {reference}</span>
        <span className="text-[10px] font-mono text-[#FBBF24]">({versionShort})</span>
      </p>
    </div>
  )
}
