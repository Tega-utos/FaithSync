import { createClient } from '@/lib/supabase/client'

export interface BibleVersion {
  id: string
  label: string
  shortName: string
}

export const BIBLE_VERSIONS: BibleVersion[] = [
  { id: 'web', label: 'World English Bible', shortName: 'WEB' },
  { id: 'kjv', label: 'King James Version', shortName: 'KJV' },
  { id: 'asv', label: 'American Standard Version', shortName: 'ASV' },
  { id: 'bbe', label: 'Bible in Basic English', shortName: 'BBE' },
  { id: 'ylt', label: "Young's Literal Translation", shortName: 'YLT' },
  { id: 'darby', label: 'Darby Translation', shortName: 'DARBY' },
]

export interface ScriptureVerseResult {
  reference: string
  text: string
  versionId: string
  versionLabel?: string
  verses?: { book_id?: string; book_name?: string; chapter: number; verse: number; text: string }[]
}

export interface ScriptureChapterResult {
  book: string
  chapter: number
  versionId: string
  verses: { verse: number; text: string }[]
}

const PROVIDER_BASE = 'https://bible-api.com'
const memoryCache = new Map<string, any>()

/**
 * Fetch a single verse or verse range (e.g., "John 3:16" or "Psalm 23:1-3")
 */
export async function getVerse(
  reference: string,
  versionId: string = 'web'
): Promise<ScriptureVerseResult> {
  const cleanRef = reference.trim()
  if (!cleanRef) {
    throw new Error('Scripture reference is required')
  }

  const key = `verse:${cleanRef.toLowerCase()}|${versionId.toLowerCase()}`
  if (memoryCache.has(key)) {
    return memoryCache.get(key)
  }

  // Check Supabase cache if available
  try {
    const supabase = createClient()
    const { data: cached } = await supabase
      .from('scripture_cache')
      .select('reference, version_id, text')
      .eq('reference', cleanRef)
      .eq('version_id', versionId)
      .maybeSingle()

    if (cached && cached.text) {
      const result: ScriptureVerseResult = {
        reference: cached.reference,
        text: cached.text,
        versionId: cached.version_id,
        versionLabel: BIBLE_VERSIONS.find((v) => v.id === cached.version_id)?.shortName || cached.version_id.toUpperCase(),
      }
      memoryCache.set(key, result)
      return result
    }
  } catch {}

  // Fetch from Bible API
  const res = await fetch(
    `${PROVIDER_BASE}/${encodeURIComponent(cleanRef)}?translation=${encodeURIComponent(versionId)}`
  )

  if (!res.ok) {
    throw new Error(`Failed to fetch scripture: "${cleanRef}" (${versionId.toUpperCase()})`)
  }

  const data = await res.json()
  const cleanText = (data.text || '').trim()

  const result: ScriptureVerseResult = {
    reference: data.reference || cleanRef,
    text: cleanText,
    versionId,
    versionLabel: BIBLE_VERSIONS.find((v) => v.id === versionId)?.shortName || versionId.toUpperCase(),
    verses: data.verses || [],
  }

  memoryCache.set(key, result)

  // Write-through to Supabase cache asynchronously
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && cleanText) {
      await supabase.from('scripture_cache').upsert(
        {
          reference: cleanRef,
          version_id: versionId,
          text: cleanText,
        },
        { onConflict: 'reference,version_id' }
      )
    }
  } catch {}

  return result
}

/**
 * Fetch a whole chapter (e.g. book = "Romans", chapter = 8)
 */
export async function getChapter(
  book: string,
  chapter: number,
  versionId: string = 'web'
): Promise<ScriptureChapterResult> {
  const cleanBook = book.trim()
  const key = `chapter:${cleanBook.toLowerCase()} ${chapter}|${versionId.toLowerCase()}`

  if (memoryCache.has(key)) {
    return memoryCache.get(key)
  }

  const ref = `${cleanBook} ${chapter}`
  const res = await fetch(
    `${PROVIDER_BASE}/${encodeURIComponent(ref)}?translation=${encodeURIComponent(versionId)}`
  )

  if (!res.ok) {
    throw new Error(`Failed to fetch chapter ${ref} (${versionId.toUpperCase()})`)
  }

  const data = await res.json()
  const verses = (data.verses || []).map((v: any) => ({
    verse: v.verse,
    text: (v.text || '').trim(),
  }))

  const result: ScriptureChapterResult = {
    book: cleanBook,
    chapter,
    versionId,
    verses,
  }

  memoryCache.set(key, result)
  return result
}

/**
 * Persist user preferred Bible version in Supabase profiles
 */
export async function setUserPreferredBibleVersion(versionId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { error } = await supabase
      .from('profiles')
      .update({ preferred_bible_version: versionId })
      .eq('id', user.id)

    return !error
  } catch {
    return false
  }
}

export interface VerseOfTheDay {
  reference: string
  text: string
  version: string
  theme: string
  book: string
  chapter: number
  verse: number
}

const DAILY_VERSES_CURATION: Omit<VerseOfTheDay, 'version'>[] = [
  {
    reference: 'Isaiah 40:31',
    book: 'Isaiah',
    chapter: 40,
    verse: 31,
    text: 'Those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint.',
    theme: 'Strength & Endurance in Daily Waiting',
  },
  {
    reference: 'Proverbs 3:5-6',
    book: 'Proverbs',
    chapter: 3,
    verse: 5,
    text: 'Trust in Yahweh with all your heart, and don’t lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.',
    theme: 'Wholehearted Trust & Divine Direction',
  },
  {
    reference: 'Philippians 4:6-7',
    book: 'Philippians',
    chapter: 4,
    verse: 6,
    text: 'In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God. And the peace of God will guard your hearts.',
    theme: 'Surrender in Prayer & Transcendent Peace',
  },
  {
    reference: 'Joshua 1:9',
    book: 'Joshua',
    chapter: 1,
    verse: 9,
    text: 'Haven’t I commanded you? Be strong and courageous. Don’t be afraid, neither be dismayed, for Yahweh your God is with you wherever you go.',
    theme: 'Courage & The Unfailing Presence of God',
  },
  {
    reference: 'Romans 8:28',
    book: 'Romans',
    chapter: 8,
    verse: 28,
    text: 'We know that all things work together for good for those who love God, for those who are called according to his purpose.',
    theme: 'Sovereign Goodness & Divine Purpose',
  },
  {
    reference: 'Psalm 23:1-3',
    book: 'Psalms',
    chapter: 23,
    verse: 1,
    text: 'Yahweh is my shepherd; I shall have no lack. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.',
    theme: 'The Good Shepherd & Restored Souls',
  },
  {
    reference: 'Matthew 6:33',
    book: 'Matthew',
    chapter: 6,
    verse: 33,
    text: 'Seek first God’s Kingdom and his righteousness, and all these things will be given to you as well.',
    theme: 'Kingdom Priorities & Faith Over Worry',
  },
  {
    reference: '2 Timothy 1:7',
    book: '2 Timothy',
    chapter: 1,
    verse: 7,
    text: 'For God didn’t give us a spirit of fear, but of power, love, and self-control.',
    theme: 'Spiritual Authority, Bold Love & Discipline',
  },
  {
    reference: 'Lamentations 3:22-23',
    book: 'Lamentations',
    chapter: 3,
    verse: 22,
    text: 'It is because of Yahweh’s loving kindnesses that we are not consumed, because his compassion doesn’t fail. They are new every morning. Great is your faithfulness.',
    theme: 'Unfailing Compassion & Daily Mercies',
  },
  {
    reference: 'Galatians 5:22-23',
    book: 'Galatians',
    chapter: 5,
    verse: 22,
    text: 'The fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faith, gentleness, and self-control.',
    theme: 'Spiritual Maturity & Fruit of the Spirit',
  },
  {
    reference: 'Colossians 3:2',
    book: 'Colossians',
    chapter: 3,
    verse: 2,
    text: 'Set your mind on the things that are above, not on the things that are on the earth.',
    theme: 'Heavenly Focus & Daily Renewal',
  },
  {
    reference: 'Hebrews 11:1',
    book: 'Hebrews',
    chapter: 11,
    verse: 1,
    text: 'Now faith is assurance of things hoped for, proof of things not seen.',
    theme: 'Unwavering Conviction & Spiritual Vision',
  },
  {
    reference: 'Psalm 46:1',
    book: 'Psalms',
    chapter: 46,
    verse: 1,
    text: 'God is our refuge and strength, a very present help in trouble.',
    theme: 'Unshakable Refuge & Present Help',
  },
  {
    reference: 'Jeremiah 29:11',
    book: 'Jeremiah',
    chapter: 29,
    verse: 11,
    text: '“For I know the plans that I have for you,” says Yahweh, “plans for peace, and not for evil, to give you hope and a future.”',
    theme: 'God’s Redemptive Plan & Hope for the Future',
  },
]

/**
 * Returns the Verse of the Day deterministically based on today's calendar date
 */
export function getVerseOfTheDay(date: Date = new Date(), versionId = 'WEB'): VerseOfTheDay {
  const startOfYear = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - startOfYear.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor(diff / oneDay)

  const index = Math.abs(dayOfYear) % DAILY_VERSES_CURATION.length
  const item = DAILY_VERSES_CURATION[index]

  return {
    ...item,
    version: versionId.toUpperCase(),
  }
}
