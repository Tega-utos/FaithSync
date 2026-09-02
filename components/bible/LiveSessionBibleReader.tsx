'use client'

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  TextAa,
  X,
  CircleNotch,
  BookmarkSimple,
  Check,
} from '@phosphor-icons/react'
import { getVerse, BIBLE_VERSIONS, BibleVersion, ScriptureVerseResult } from '@/lib/scripture'

export interface LiveSessionBibleReaderProps {
  initialReference?: string
  isOpen: boolean
  onClose: () => void
  onVerseSelect?: (ref: string) => void
}

const COMMON_STUDY_BOOKS = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', 'Hebrews', 'James', '1 Peter', '1 John', 'Revelation',
  'Genesis', 'Psalms', 'Proverbs', 'Isaiah'
]

export function LiveSessionBibleReader({
  initialReference = 'John 1',
  isOpen,
  onClose,
  onVerseSelect,
}: LiveSessionBibleReaderProps) {
  const [referenceInput, setReferenceInput] = useState(initialReference)
  const [currentReference, setCurrentReference] = useState(initialReference)
  const [selectedVersion, setSelectedVersion] = useState<string>('web')
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base')
  const [verseData, setVerseData] = useState<ScriptureVerseResult | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedRef, setCopiedRef] = useState<string | null>(null)

  useEffect(() => {
    if (initialReference) {
      setReferenceInput(initialReference)
      setCurrentReference(initialReference)
    }
  }, [initialReference])

  useEffect(() => {
    if (!isOpen || !currentReference.trim()) return

    let isMounted = true
    setLoading(true)
    setError(null)

    getVerse(currentReference, selectedVersion)
      .then((data) => {
        if (isMounted) {
          setVerseData(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Unable to load scripture passage.')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [currentReference, selectedVersion, isOpen])

  if (!isOpen) return null

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (referenceInput.trim()) {
      setCurrentReference(referenceInput.trim())
    }
  }

  const handleQuickBookSelect = (book: string) => {
    const newRef = `${book} 1`
    setReferenceInput(newRef)
    setCurrentReference(newRef)
  }

  const handleCopyPassage = () => {
    if (verseData?.text) {
      navigator.clipboard.writeText(`${verseData.reference} (${verseData.versionLabel || selectedVersion.toUpperCase()}):\n${verseData.text}`)
      setCopiedRef(verseData.reference)
      setTimeout(() => setCopiedRef(null), 2500)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#FAF6EE] border border-[#E5E7EB] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] h-full animate-in slide-in-from-bottom-6 duration-300">
        
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] shrink-0 bg-[#F5EFE1]/60 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0E0E0E] text-[#FBBF24] flex items-center justify-center shadow-xs">
              <BookOpen size={18} weight="bold" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#0E0E0E] tracking-tight">
                Scripture Study Reader
              </h3>
              <p className="text-[10px] text-[#707070] font-medium">
                Synchronized In-App Scripture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Version Selector */}
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="px-2.5 py-1 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] cursor-pointer shadow-2xs"
            >
              {BIBLE_VERSIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.shortName}
                </option>
              ))}
            </select>

            {/* Font Size Toggle */}
            <div className="flex items-center bg-white border border-[#E5E7EB] rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setFontSize('sm')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                  fontSize === 'sm' ? 'bg-[#0E0E0E] text-white' : 'text-[#707070]'
                }`}
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize('base')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  fontSize === 'base' ? 'bg-[#0E0E0E] text-white' : 'text-[#707070]'
                }`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('lg')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                  fontSize === 'lg' ? 'bg-[#0E0E0E] text-white' : 'text-[#707070]'
                }`}
              >
                A+
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[#707070] hover:text-[#0E0E0E] hover:bg-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar & Quick Books */}
        <div className="p-3.5 border-b border-[#E5E7EB] bg-white space-y-2.5 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#707070]"
              />
              <input
                type="text"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                placeholder="Search passage, e.g. Hebrews 11:1-6 or Psalm 23"
                className="w-full pl-9 pr-4 py-2 bg-[#FAF6EE] border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] placeholder-[#9095A1] focus:outline-none focus:border-[#FBBF24] focus:bg-white transition-all shadow-xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#0E0E0E] text-white rounded-xl text-xs font-bold hover:bg-[#262626] transition-all shadow-xs"
            >
              Read
            </button>
          </form>

          {/* Quick Book Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {COMMON_STUDY_BOOKS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => handleQuickBookSelect(b)}
                className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] hover:bg-[#F3F4F6] border border-[#E5E7EB] text-[11px] font-bold text-[#707070] hover:text-[#0E0E0E] whitespace-nowrap transition-colors"
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Scripture Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 font-serif">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
              <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
              <p className="text-xs text-[#707070] font-sans">Opening scripture passage...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans text-center space-y-2">
              <p className="font-bold">{error}</p>
              <p className="text-[11px] text-amber-700">
                Try searching with book and chapter, e.g. &ldquo;John 3&rdquo; or &ldquo;Romans 8:28-39&rdquo;.
              </p>
            </div>
          ) : verseData ? (
            <div className="space-y-4">
              {/* Passage Title Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]/80 font-sans">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#0E0E0E] tracking-tight">
                    {verseData.reference}
                  </h2>
                  <span className="text-[10px] font-bold text-[#FBBF24] bg-[#0E0E0E] px-2 py-0.5 rounded-md">
                    {verseData.versionLabel || selectedVersion.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPassage}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#0E0E0E] hover:border-[#FBBF24] shadow-2xs transition-all"
                  >
                    {copiedRef ? (
                      <>
                        <Check size={14} className="text-emerald-500" weight="bold" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <BookmarkSimple size={14} className="text-[#FBBF24]" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Verses Text */}
              <div
                className={`leading-relaxed text-[#0E0E0E] space-y-3 ${
                  fontSize === 'sm'
                    ? 'text-xs sm:text-sm'
                    : fontSize === 'lg'
                    ? 'text-base sm:text-lg'
                    : 'text-sm sm:text-base'
                }`}
              >
                {verseData.verses && verseData.verses.length > 0 ? (
                  verseData.verses.map((v, i) => (
                    <p key={i} className="inline mr-2 leading-loose">
                      <span className="font-sans font-black text-[10px] text-[#FBBF24] align-super mr-1 select-none">
                        {v.verse}
                      </span>
                      <span>{v.text.trim()} </span>
                    </p>
                  ))
                ) : (
                  <p className="whitespace-pre-line leading-loose">{verseData.text}</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Dock Info */}
        <div className="p-3 border-t border-[#E5E7EB] bg-[#F5EFE1]/60 flex items-center justify-between text-xs font-sans rounded-b-3xl shrink-0">
          <span className="text-[10px] text-[#707070] font-medium">
            Live Shared Study Session
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0E0E0E] text-white rounded-xl text-xs font-bold hover:bg-[#262626] transition-all"
          >
            Done Reading
          </button>
        </div>
      </div>
    </div>
  )
}
