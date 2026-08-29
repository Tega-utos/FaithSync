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
} from '@phosphor-icons/react'
import { useTimer, TimerSessionData } from '@/context/TimerContext'
import { TimerPill } from '@/components/session/TimerPill'
import { SessionSummaryModal } from '@/components/session/SessionSummaryModal'

import { BIBLE_VERSIONS, getChapter, setUserPreferredBibleVersion } from '@/lib/scripture'
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

  // Failsafe Summary Modal
  const [showSummary, setShowSummary] = useState(false)
  const [summaryData, setSummaryData] = useState<TimerSessionData | null>(null)

  const currentBookObj = BIBLE_BOOKS.find((b) => b.name === selectedBook) || BIBLE_BOOKS[44]
  const totalChapters = currentBookObj.chapters

  // Load user preferred translation on mount
  useEffect(() => {
    async function loadUserVersion() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('preferred_bible_version')
            .eq('id', user.id)
            .single()
          if (profile?.preferred_bible_version) {
            setSelectedVersion(profile.preferred_bible_version)
          }
        }
      } catch {}
    }
    loadUserVersion()
  }, [])

  // Fetch Scripture text using centralized getChapter
  useEffect(() => {
    async function fetchChapter() {
      setLoading(true)
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
      router.push('/')
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

  const currentFontSize = FONT_SIZES[fontSizeIndex]
  const currentVersionObj = BIBLE_VERSIONS.find((v) => v.id === selectedVersion) || BIBLE_VERSIONS[0]

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FAF9F6] text-[#1A1A1A] pb-28 relative">
      {/* Top Sticky Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#F3F4F6] px-3 sm:px-6 py-2.5 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={handleBackWithFailsafe}
            className="p-1.5 rounded-xl text-[#707070] hover:text-[#0E0E0E] hover:bg-[#FAF9F6] transition-colors flex items-center gap-1 text-xs font-bold shrink-0"
          >
            <CaretLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Inline Book, Chapter & Translation Dropdowns */}
          <div className="flex items-center gap-1.5 flex-1 justify-center max-w-sm">
            <select
              value={selectedBook}
              onChange={(e) => {
                setSelectedBook(e.target.value)
                setSelectedChapter(1)
              }}
              className="bg-[#FAF9F6] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-xs font-bold text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] cursor-pointer max-w-[110px]"
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
              className="bg-[#FAF9F6] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-xs font-bold text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] cursor-pointer font-mono"
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
              className="bg-[#FAF9F6] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-xs font-bold text-[#FBBF24] focus:outline-none focus:border-[#FBBF24] cursor-pointer font-mono"
            >
              {BIBLE_VERSIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.shortName}
                </option>
              ))}
            </select>
          </div>

          {/* Font Resizer */}
          <div className="flex items-center gap-1 shrink-0 bg-[#FAF9F6] border border-[#E5E7EB] rounded-xl p-0.5">
            <button
              type="button"
              disabled={fontSizeIndex === 0}
              onClick={() => setFontSizeIndex((prev) => Math.max(0, prev - 1))}
              className="px-2 py-1 text-xs font-bold text-[#707070] hover:text-[#0E0E0E] disabled:opacity-30"
              title="Decrease Font Size"
            >
              A-
            </button>
            <div className="w-px h-3 bg-[#E5E7EB]" />
            <button
              type="button"
              disabled={fontSizeIndex === FONT_SIZES.length - 1}
              onClick={() => setFontSizeIndex((prev) => Math.min(FONT_SIZES.length - 1, prev + 1))}
              className="px-2 py-1 text-xs font-bold text-[#707070] hover:text-[#0E0E0E] disabled:opacity-30"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>
        </div>
      </header>

      {/* Scripture Chapter Content */}
      <main className="max-w-xl mx-auto px-5 sm:px-6 pt-6 space-y-6">
        <div className="text-center space-y-1 pb-4 border-b border-[#F3F4F6]">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#0E0E0E]">
            {selectedBook} {selectedChapter}
          </h1>
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#9095A1]">
            {currentVersionObj.label} ({currentVersionObj.shortName})
          </p>
        </div>

        {loading ? (
          <div className="py-24 text-center text-xs text-[#707070] font-medium font-serif italic">
            Opening {selectedBook} {selectedChapter}...
          </div>
        ) : (
          <div
            className="font-serif leading-loose text-[#1A1A1A] space-y-3 selection:bg-[#FBBF24]/20"
            style={{ fontSize: `${currentFontSize}px`, lineHeight: 1.85 }}
          >
            {verses.map((v) => (
              <span key={v.verse} className="inline mr-1.5">
                <sup className="text-[0.65em] font-sans font-extrabold text-[#FBBF24] mr-1 select-none">
                  {v.verse}
                </sup>
                <span>{v.text} </span>
              </span>
            ))}
          </div>
        )}
      </main>

      {/* Pagination Arrows */}
      {selectedChapter > 1 && (
        <button
          type="button"
          onClick={handlePrevChapter}
          className="fixed bottom-6 left-4 sm:left-8 z-40 w-11 h-11 rounded-full bg-white border border-[#E5E7EB] shadow-lg flex items-center justify-center text-[#0E0E0E] hover:bg-[#FAF9F6] hover:scale-105 active:scale-95 transition-all"
          title={`Previous: Chapter ${selectedChapter - 1}`}
        >
          <CaretLeft size={20} />
        </button>
      )}

      {selectedChapter < totalChapters && (
        <button
          type="button"
          onClick={handleNextChapter}
          className="fixed bottom-6 right-4 sm:right-8 z-40 w-11 h-11 rounded-full bg-white border border-[#E5E7EB] shadow-lg flex items-center justify-center text-[#0E0E0E] hover:bg-[#FAF9F6] hover:scale-105 active:scale-95 transition-all"
          title={`Next: Chapter ${selectedChapter + 1}`}
        >
          <CaretRight size={20} />
        </button>
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
