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
