'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CaretLeft,
  CaretRight,
  BookOpen,
  Sparkle,
  MagnifyingGlass,
  Copy,
  ShareNetwork,
  Clock,
  BookmarkSimple,
  Check,
  X,
  HandsPraying,
  CircleNotch,
} from '@phosphor-icons/react'
import { useTimer, TimerSessionData } from '@/context/TimerContext'
import { TimerPill } from '@/components/session/TimerPill'
import { SessionSummaryModal } from '@/components/session/SessionSummaryModal'

import { BIBLE_VERSIONS, getChapter, getVerse, setUserPreferredBibleVersion } from '@/lib/scripture'
import { createClient } from '@/lib/supabase/client'

const BIBLE_BOOKS = [
  // Old Testament
  { name: 'Genesis', chapters: 50 },
  { name: 'Exodus', chapters: 40 },
  { name: 'Leviticus', chapters: 27 },
  { name: 'Numbers', chapters: 36 },
  { name: 'Deuteronomy', chapters: 34 },
  { name: 'Joshua', chapters: 24 },
  { name: 'Judges', chapters: 21 },
  { name: 'Ruth', chapters: 4 },
  { name: '1 Samuel', chapters: 31 },
  { name: '2 Samuel', chapters: 24 },
  { name: '1 Kings', chapters: 22 },
  { name: '2 Kings', chapters: 25 },
  { name: '1 Chronicles', chapters: 29 },
  { name: '2 Chronicles', chapters: 36 },
  { name: 'Ezra', chapters: 10 },
  { name: 'Nehemiah', chapters: 13 },
  { name: 'Esther', chapters: 10 },
  { name: 'Job', chapters: 42 },
  { name: 'Psalms', chapters: 150 },
  { name: 'Proverbs', chapters: 31 },
  { name: 'Ecclesiastes', chapters: 12 },
  { name: 'Song of Solomon', chapters: 8 },
  { name: 'Isaiah', chapters: 66 },
  { name: 'Jeremiah', chapters: 52 },
  { name: 'Lamentations', chapters: 5 },
  { name: 'Ezekiel', chapters: 48 },
  { name: 'Daniel', chapters: 12 },
  { name: 'Hosea', chapters: 14 },
  { name: 'Joel', chapters: 3 },
  { name: 'Amos', chapters: 9 },
  { name: 'Obadiah', chapters: 1 },
  { name: 'Jonah', chapters: 4 },
  { name: 'Micah', chapters: 7 },
  { name: 'Nahum', chapters: 3 },
  { name: 'Habakkuk', chapters: 3 },
  { name: 'Zephaniah', chapters: 3 },
  { name: 'Haggai', chapters: 2 },
  { name: 'Zechariah', chapters: 14 },
  { name: 'Malachi', chapters: 4 },
  // New Testament
  { name: 'Matthew', chapters: 28 },
  { name: 'Mark', chapters: 16 },
  { name: 'Luke', chapters: 24 },
  { name: 'John', chapters: 21 },
  { name: 'Acts', chapters: 28 },
  { name: 'Romans', chapters: 16 },
  { name: '1 Corinthians', chapters: 16 },
  { name: '2 Corinthians', chapters: 13 },
  { name: 'Galatians', chapters: 6 },
  { name: 'Ephesians', chapters: 6 },
  { name: 'Philippians', chapters: 4 },
  { name: 'Colossians', chapters: 4 },
  { name: '1 Thessalonians', chapters: 5 },
  { name: '2 Thessalonians', chapters: 3 },
  { name: '1 Timothy', chapters: 6 },
  { name: '2 Timothy', chapters: 4 },
  { name: 'Titus', chapters: 3 },
  { name: 'Philemon', chapters: 1 },
  { name: 'Hebrews', chapters: 13 },
  { name: 'James', chapters: 5 },
  { name: '1 Peter', chapters: 5 },
  { name: '2 Peter', chapters: 3 },
  { name: '1 John', chapters: 5 },
  { name: '2 John', chapters: 1 },
  { name: '3 John', chapters: 1 },
  { name: 'Jude', chapters: 1 },
  { name: 'Revelation', chapters: 22 },
]

const FONT_SIZES = [14, 16, 18, 20, 24, 28]

export default function BiblePage() {
  const router = useRouter()
  const { session, stopTimer } = useTimer()

  const [selectedBook, setSelectedBook] = useState('Romans')
  const [selectedChapter, setSelectedChapter] = useState(8)
  const [selectedVersion, setSelectedVersion] = useState('web')
  const [fontSizeIndex, setFontSizeIndex] = useState(2) // Default: 18px
  const [verses, setVerses] = useState<{ verse: number; text: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Interactive Verse Selection
  const [selectedVerse, setSelectedVerse] = useState<{ verse: number; text: string } | null>(null)
  const [highlightedVerses, setHighlightedVerses] = useState<number[]>([])
  const [copiedNotification, setCopiedNotification] = useState(false)

  // Quick Jump Search Modal
  const [isJumpModalOpen, setIsJumpModalOpen] = useState(false)
  const [jumpQuery, setJumpQuery] = useState('')
  const [jumpSearching, setJumpSearching] = useState(false)
  const [jumpError, setJumpError] = useState<string | null>(null)

  // Failsafe Summary Modal
  const [showSummary, setShowSummary] = useState(false)
  const [summaryData, setSummaryData] = useState<TimerSessionData | null>(null)

  const currentBookObj = BIBLE_BOOKS.find((b) => b.name === selectedBook) || BIBLE_BOOKS[44]
  const totalChapters = currentBookObj.chapters

  // Load user preferred translation and saved highlights on mount
  useEffect(() => {
    async function loadUserPrefs() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferred_bible_version, preferences')
            .eq('id', user.id)
            .single()
          if (profile?.preferred_bible_version) {
            setSelectedVersion(profile.preferred_bible_version)
          }
          const savedHighlights = (profile?.preferences as any)?.bible_highlights?.[`${selectedBook}_${selectedChapter}`]
          if (savedHighlights && Array.isArray(savedHighlights)) {
            setHighlightedVerses(savedHighlights)
          }
        }
      } catch {}
    }
    loadUserPrefs()
  }, [selectedBook, selectedChapter])

  // Fetch Scripture text using centralized getChapter
  useEffect(() => {
    async function fetchChapter() {
      setLoading(true)
      setSelectedVerse(null)
      try {
        const result = await getChapter(selectedBook, selectedChapter, selectedVersion)
        setVerses(result.verses)
      } catch (err) {
        console.error('Bible fetch error:', err)
        setVerses([])
      } finally {
        setLoading(false)
      }
    }

    fetchChapter()
  }, [selectedBook, selectedChapter, selectedVersion])

  const handleVersionChange = (newVer: string) => {
    setSelectedVersion(newVer)
    setUserPreferredBibleVersion(newVer)
  }

  // Failsafe Back Navigation
  const handleBackWithFailsafe = () => {
    if (session.isActive) {
      const data = stopTimer()
      setSummaryData(data)
      setShowSummary(true)
    } else {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
      } else {
        router.push('/home')
      }
    }
  }

  const handleEndSession = (data: TimerSessionData) => {
    setSummaryData(data)
    setShowSummary(true)
  }

  const handlePrevChapter = () => {
    if (selectedChapter > 1) {
      setSelectedChapter((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNextChapter = () => {
    if (selectedChapter < totalChapters) {
      setSelectedChapter((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handle Verse Actions
  const handleCopySelectedVerse = () => {
    if (!selectedVerse) return
    const passage = `${selectedBook} ${selectedChapter}:${selectedVerse.verse} (${selectedVersion.toUpperCase()}):\n"${selectedVerse.text}"`
    navigator.clipboard.writeText(passage)
    setCopiedNotification(true)
    setTimeout(() => setCopiedNotification(false), 2000)
  }

  const handleShareToSquare = () => {
    if (!selectedVerse) return
    const ref = `${selectedBook} ${selectedChapter}:${selectedVerse.verse}`
    router.push(`/square?compose=true&ref=${encodeURIComponent(ref)}&verse=${encodeURIComponent(selectedVerse.text)}&intent=reflection`)
  }

  const handleStartDevotionWithVerse = () => {
    if (!selectedVerse) return
    const ref = `${selectedBook} ${selectedChapter}:${selectedVerse.verse}`
    router.push(`/clock-in?discipline=study&focus=${encodeURIComponent(ref)}`)
  }

  const handleToggleHighlight = async () => {
    if (!selectedVerse) return
    const vNum = selectedVerse.verse
    const nextHighlights = highlightedVerses.includes(vNum)
      ? highlightedVerses.filter((v) => v !== vNum)
      : [...highlightedVerses, vNum]

    setHighlightedVerses(nextHighlights)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('preferences').eq('id', user.id).single()
        const currentPrefs = (prof?.preferences as any) || {}
        const currentHighlights = currentPrefs.bible_highlights || {}
        const updatedHighlights = {
          ...currentHighlights,
          [`${selectedBook}_${selectedChapter}`]: nextHighlights,
        }
        await supabase.from('profiles').update({
          preferences: {
            ...currentPrefs,
            bible_highlights: updatedHighlights,
          },
        }).eq('id', user.id)
      }
    } catch (err) {
      console.error('Highlight save note:', err)
    }
  }

  // Handle Quick Reference Jump
  const handleQuickJump = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jumpQuery.trim()) return

    setJumpSearching(true)
    setJumpError(null)

    try {
      const parsed = await getVerse(jumpQuery.trim(), selectedVersion)
      if (parsed && parsed.verses && parsed.verses.length > 0) {
        const firstVerse = parsed.verses[0]
        const bookName = firstVerse.book_name || selectedBook
        const matchingBook = BIBLE_BOOKS.find((b) => b.name.toLowerCase() === bookName.toLowerCase())
        if (matchingBook) {
          setSelectedBook(matchingBook.name)
          setSelectedChapter(firstVerse.chapter)
          setIsJumpModalOpen(false)
          setJumpQuery('')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          setJumpError(`Found passage for ${bookName}, but book index could not match.`)
        }
      } else {
        setJumpError('Could not locate that scripture passage.')
      }
    } catch (err: any) {
      setJumpError(err?.message || 'Invalid scripture reference.')
    } finally {
      setJumpSearching(false)
    }
  }

  const currentFontSize = FONT_SIZES[fontSizeIndex]
  const currentVersionObj = BIBLE_VERSIONS.find((v) => v.id === selectedVersion) || BIBLE_VERSIONS[0]

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FAF9F6] dark:bg-neutral-950 text-[#1A1A1A] dark:text-neutral-100 pb-28 relative">
      {/* Top Sticky Navigation Bar */}
      <header className="sticky top-0 z-40 bg-card/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-border dark:border-neutral-800 px-2 sm:px-6 py-2 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar flex-nowrap py-0.5">
          {/* Back Button */}
          <button
            type="button"
            onClick={handleBackWithFailsafe}
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle dark:hover:bg-neutral-800 transition-colors flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer"
          >
            <CaretLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Inline Book, Chapter & Translation Dropdowns */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={selectedBook}
              onChange={(e) => {
                setSelectedBook(e.target.value)
                setSelectedChapter(1)
              }}
              className="bg-[#FAF9F6] dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-primary dark:text-neutral-100 focus:outline-none focus:border-[#FBBF24] cursor-pointer min-w-[95px] max-w-[130px]"
            >
              {BIBLE_BOOKS.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(Number(e.target.value))}
              className="bg-[#FAF9F6] dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-xl px-2 py-1.5 text-xs font-bold text-text-primary dark:text-neutral-100 focus:outline-none focus:border-[#FBBF24] cursor-pointer font-mono"
            >
              {Array.from({ length: totalChapters }, (_, i) => i + 1).map((ch) => (
                <option key={ch} value={ch}>
                  Ch. {ch}
                </option>
              ))}
            </select>

            <select
              value={selectedVersion}
              onChange={(e) => handleVersionChange(e.target.value)}
              className="bg-[#FAF9F6] dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-xl px-2 py-1.5 text-xs font-bold text-[#FBBF24] focus:outline-none focus:border-[#FBBF24] cursor-pointer font-mono"
            >
              {BIBLE_VERSIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.shortName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Jump Search Button */}
            <button
              type="button"
              onClick={() => setIsJumpModalOpen(true)}
              className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-subtle dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
              title="Jump to Scripture Reference"
            >
              <MagnifyingGlass size={18} />
            </button>

            {/* Font Resizer */}
            <div className="flex items-center gap-1 bg-[#FAF9F6] dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-xl p-0.5 shrink-0">
              <button
                type="button"
                disabled={fontSizeIndex === 0}
                onClick={() => setFontSizeIndex((prev) => Math.max(0, prev - 1))}
                className="px-2 py-1 text-xs font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer"
                title="Decrease Font Size"
              >
                A-
              </button>
              <div className="w-px h-3 bg-border dark:bg-neutral-800" />
              <button
                type="button"
                disabled={fontSizeIndex === FONT_SIZES.length - 1}
                onClick={() => setFontSizeIndex((prev) => Math.min(FONT_SIZES.length - 1, prev + 1))}
                className="px-2 py-1 text-xs font-bold text-text-secondary hover:text-text-primary disabled:opacity-30 cursor-pointer"
                title="Increase Font Size"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Scripture Chapter Content */}
      <main className="max-w-3xl lg:max-w-4xl mx-auto px-5 sm:px-8 pt-6 space-y-6">
        <div className="text-center space-y-1 pb-4 border-b border-border dark:border-neutral-800">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-text-primary dark:text-neutral-100">
            {selectedBook} {selectedChapter}
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted dark:text-neutral-400">
            {currentVersionObj.label} ({currentVersionObj.shortName})
          </p>
        </div>

        {loading ? (
          <div className="py-24 text-center text-xs text-text-secondary dark:text-neutral-400 font-medium font-serif italic">
            Opening {selectedBook} {selectedChapter}...
          </div>
        ) : (
          <div
            className="font-serif leading-loose text-text-primary dark:text-neutral-200 space-y-3 selection:bg-[#FBBF24]/20"
            style={{ fontSize: `${currentFontSize}px`, lineHeight: 1.85 }}
          >
            {verses.map((v) => {
              const isSelected = selectedVerse?.verse === v.verse
              const isHighlighted = highlightedVerses.includes(v.verse)

              return (
                <span
                  key={v.verse}
                  onClick={() => setSelectedVerse(isSelected ? null : v)}
                  className={`inline mr-1.5 px-1 py-0.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#FBBF24]/30 dark:bg-[#FBBF24]/20 ring-2 ring-[#FBBF24]'
                      : isHighlighted
                      ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <sup className="text-[0.65em] font-sans font-extrabold text-[#FBBF24] mr-1 select-none">
                    {v.verse}
                  </sup>
                  <span>{v.text} </span>
                </span>
              )
            })}
          </div>
        )}
      </main>

      {/* Floating Verse Action Bar (Shown when a verse is tapped) */}
      {selectedVerse && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-bottom duration-200">
          <div className="bg-[#0E0E0E] dark:bg-[#1A1610] border border-[#FBBF24]/40 text-white rounded-2xl p-3 shadow-2xl space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <span className="text-xs font-black text-[#FBBF24]">
                {selectedBook} {selectedChapter}:{selectedVerse.verse}
              </span>
              <button
                type="button"
                onClick={() => setSelectedVerse(null)}
                className="text-white/60 hover:text-white p-0.5"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={handleCopySelectedVerse}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
              >
                {copiedNotification ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span>{copiedNotification ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleHighlight}
                className={`p-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  highlightedVerses.includes(selectedVerse.verse)
                    ? 'bg-[#FBBF24] text-[#1A1610]'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <BookmarkSimple size={16} weight={highlightedVerses.includes(selectedVerse.verse) ? 'fill' : 'regular'} />
                <span>Highlight</span>
              </button>

              <button
                type="button"
                onClick={handleShareToSquare}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
              >
                <ShareNetwork size={16} />
                <span>Square</span>
              </button>

              <button
                type="button"
                onClick={handleStartDevotionWithVerse}
                className="p-2 rounded-xl bg-[#FBBF24] hover:bg-[#F59E0B] text-[#1A1610] text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer"
              >
                <Clock size={16} weight="fill" />
                <span>Devotion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Arrows */}
      {selectedChapter > 1 && (
        <button
          type="button"
          onClick={handlePrevChapter}
          className="fixed bottom-6 left-4 sm:left-8 z-40 w-11 h-11 rounded-full bg-card dark:bg-neutral-900 border border-border dark:border-neutral-800 shadow-lg flex items-center justify-center text-text-primary dark:text-neutral-100 hover:bg-[#FAF9F6] dark:hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={`Previous: Chapter ${selectedChapter - 1}`}
        >
          <CaretLeft size={20} />
        </button>
      )}

      {selectedChapter < totalChapters && (
        <button
          type="button"
          onClick={handleNextChapter}
          className="fixed bottom-6 right-4 sm:right-8 z-40 w-11 h-11 rounded-full bg-card dark:bg-neutral-900 border border-border dark:border-neutral-800 shadow-lg flex items-center justify-center text-text-primary dark:text-neutral-100 hover:bg-[#FAF9F6] dark:hover:bg-neutral-800 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={`Next: Chapter ${selectedChapter + 1}`}
        >
          <CaretRight size={20} />
        </button>
      )}

      {/* Quick Reference Jump Modal */}
      {isJumpModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          data-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div className="w-full max-w-sm bg-surface border border-border rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-extrabold text-text-primary">Jump to Scripture</h3>
              <button
                type="button"
                onClick={() => {
                  setIsJumpModalOpen(false)
                  setJumpError(null)
                }}
                className="text-text-secondary hover:text-text-primary p-1 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickJump} className="space-y-3">
              <div className="space-y-1">
                <input
                  type="text"
                  value={jumpQuery}
                  onChange={(e) => setJumpQuery(e.target.value)}
                  placeholder="e.g. Psalm 23, John 3:16, Romans 12"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-surface/80 dark:bg-neutral-900/80 border border-border/80 dark:border-white/15 rounded-2xl text-[13.5px] font-normal text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-border focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10"
                />
                {jumpError && (
                  <p className="text-[11px] text-rose-500 font-semibold px-1">{jumpError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsJumpModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-card border border-border text-xs font-bold text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={jumpSearching || !jumpQuery.trim()}
                  className="py-2.5 px-4 rounded-xl bg-[#0E0E0E] dark:bg-[#1E1B16] text-white dark:text-[#F5F1E8] border border-transparent dark:border-white/15 text-xs font-bold hover:bg-[#262626] transition-all flex items-center gap-1.5"
                >
                  {jumpSearching ? <CircleNotch size={14} className="animate-spin text-[#FBBF24]" /> : <MagnifyingGlass size={14} className="text-[#FBBF24]" />}
                  <span>Jump</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Timer Pill */}
      <TimerPill onEndSession={handleEndSession} />

      {/* Session Summary Modal */}
      <SessionSummaryModal
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        sessionData={summaryData}
        onSaved={() => {
          setShowSummary(false)
          router.push('/')
        }}
      />
    </div>
  )
}
