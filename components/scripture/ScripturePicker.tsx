'use client'

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  MagnifyingGlass,
  X,
  Check,
  CircleNotch,
  CaretDown,
  Sparkle,
} from '@phosphor-icons/react'
import { BIBLE_VERSIONS, getVerse, BibleVersion } from '@/lib/scripture'
import { ScriptureText } from './ScriptureText'

export interface ScriptureSelection {
  reference: string
  versionId: string
  text?: string
}

export interface ScripturePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (selection: ScriptureSelection) => void
  initialReference?: string
  initialVersionId?: string
}

const POPULAR_REFERENCES = [
  'Psalm 23:1-3',
  'Philippians 4:6-7',
  'Romans 8:28',
  'Jeremiah 29:11',
  'Proverbs 3:5-6',
  'Matthew 6:33',
  'Isaiah 40:31',
  'Hebrews 11:1',
  'John 3:16',
]

const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
]

export function ScripturePicker({
  isOpen,
  onClose,
  onSelect,
  initialReference = 'Psalm 23:1-3',
  initialVersionId = 'web',
}: ScripturePickerProps) {
  const [referenceInput, setReferenceInput] = useState(initialReference)
  const [selectedVersion, setSelectedVersion] = useState(initialVersionId)
  const [activeTab, setActiveTab] = useState<'search' | 'browse'>('search')

  // Browse state
  const [browseBook, setBrowseBook] = useState('Romans')
  const [browseChapter, setBrowseChapter] = useState('8')
  const [browseVerse, setBrowseVerse] = useState('28')

  // Preview state
  const [previewRef, setPreviewRef] = useState(initialReference)
  const [previewText, setPreviewText] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Fetch preview whenever previewRef or selectedVersion changes
  useEffect(() => {
    if (!isOpen || !previewRef.trim()) return

    let isMounted = true
    setLoadingPreview(true)
    setPreviewError(null)

    const timer = setTimeout(() => {
      getVerse(previewRef.trim(), selectedVersion)
        .then((res) => {
          if (isMounted) {
            setPreviewText(res.text)
            setLoadingPreview(false)
          }
        })
        .catch((err) => {
          if (isMounted) {
            setPreviewError(err.message || 'Reference not found')
            setPreviewText('')
            setLoadingPreview(false)
          }
        })
    }, 300)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [isOpen, previewRef, selectedVersion])

  if (!isOpen) return null

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (referenceInput.trim()) {
      setPreviewRef(referenceInput.trim())
    }
  }

  const handleApplyBrowse = () => {
    const constructed = `${browseBook} ${browseChapter}${browseVerse.trim() ? `:${browseVerse.trim()}` : ''}`
    setReferenceInput(constructed)
    setPreviewRef(constructed)
    setActiveTab('search')
  }

  const handleConfirm = () => {
    if (!previewRef.trim() || previewError) return
    onSelect({
      reference: previewRef.trim(),
      versionId: selectedVersion,
      text: previewText,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/40 dark:border-amber-500/30 text-[#FBBF24] flex items-center justify-center">
              <BookOpen size={18} weight="fill" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Select Scripture</h3>
              <p className="text-[10px] text-text-secondary">Attach a verse or passage</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#E5E7EB] text-text-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Translation Selector Bar */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-card border border-border shrink-0">
          <span className="text-xs font-bold text-text-secondary ml-1">Translation:</span>
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {BIBLE_VERSIONS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVersion(v.id)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  selectedVersion === v.id
                    ? 'bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-subtle'
                }`}
              >
                {v.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="p-1 rounded-2xl bg-subtle/70 border border-border grid grid-cols-2 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`py-1.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'search'
                ? 'bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Search Reference
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`py-1.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'browse'
                ? 'bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Browse Books
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1 space-y-3.5 pr-0.5">
          {activeTab === 'search' ? (
            <div className="space-y-3">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  value={referenceInput}
                  onChange={(e) => setReferenceInput(e.target.value)}
                  placeholder="e.g. John 3:16, Psalm 23:1-3, Romans 8:28"
                  className="w-full bg-card border border-border rounded-2xl py-2.5 pl-3.5 pr-10 text-xs font-semibold text-text-primary focus:outline-none focus:border-[#FBBF24] shadow-inner"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] hover:bg-[#262626] dark:hover:bg-white/80 transition-colors"
                  title="Search Reference"
                >
                  <MagnifyingGlass size={14} weight="bold" />
                </button>
              </form>

              {/* Suggestions */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  Suggested Passages
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_REFERENCES.map((ref) => (
                    <button
                      key={ref}
                      type="button"
                      onClick={() => {
                        setReferenceInput(ref)
                        setPreviewRef(ref)
                      }}
                      className="px-2.5 py-1 rounded-xl bg-card border border-border text-[11px] font-bold text-text-primary hover:border-[#FBBF24] hover:text-[#FBBF24] transition-all"
                    >
                      {ref}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-3 rounded-2xl bg-card border border-border">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Book
                  </label>
                  <select
                    value={browseBook}
                    onChange={(e) => setBrowseBook(e.target.value)}
                    className="w-full p-2 text-xs font-bold rounded-xl border border-border bg-surface text-text-primary focus:outline-none"
                  >
                    {BIBLE_BOOKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Chapter
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={browseChapter}
                    onChange={(e) => setBrowseChapter(e.target.value)}
                    className="w-full p-2 text-xs font-bold rounded-xl border border-border bg-surface text-text-primary focus:outline-none text-center"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Verse(s)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1-3"
                    value={browseVerse}
                    onChange={(e) => setBrowseVerse(e.target.value)}
                    className="w-full p-2 text-xs font-bold rounded-xl border border-border bg-surface text-text-primary focus:outline-none text-center"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyBrowse}
                className="w-full py-2 bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-xs rounded-xl hover:bg-[#262626] dark:hover:bg-white/80 transition-colors"
              >
                Inspect Selection
              </button>
            </div>
          )}

          {/* Live Verse Preview */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Live Preview ({previewRef})
            </span>

            <div className="p-3.5 rounded-2xl bg-card border border-border min-h-[80px] flex items-center justify-center">
              {loadingPreview ? (
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <CircleNotch size={16} className="animate-spin text-[#FBBF24]" />
                  <span>Loading scripture...</span>
                </div>
              ) : previewError ? (
                <p className="text-xs text-rose-500 italic text-center">{previewError}</p>
              ) : previewText ? (
                <div className="space-y-1.5 w-full">
                  <p className="text-xs text-text-primary italic leading-relaxed">
                    &ldquo;{previewText}&rdquo;
                  </p>
                  <p className="text-[10px] font-bold text-text-secondary text-right font-mono">
                    — {previewRef} ({BIBLE_VERSIONS.find((v) => v.id === selectedVersion)?.shortName})
                  </p>
                </div>
              ) : (
                <p className="text-xs text-text-secondary italic">Enter a reference above to preview</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary hover:text-text-primary hover:bg-card transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!previewText || loadingPreview || !!previewError}
            className="px-5 py-2.5 rounded-xl bg-[#FBBF24] text-white text-xs font-bold shadow-md hover:bg-[#D97706] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
          >
            <Check size={16} weight="bold" />
            <span>Attach Scripture</span>
          </button>
        </div>
      </div>
    </div>
  )
}
