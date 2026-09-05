'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { calculateUserStreak } from '@/lib/utils/streak'

export const SQUARE_CACHE_KEY = 'square_feed_posts'

export interface SquarePostItem {
  id: string
  user_id: string
  author_id?: string
  content: string
  verse_reference?: string
  scripture_reference?: string
  scripture_version_id?: string
  post_type: 'prayer' | 'prayer_request' | 'struggle' | 'testimony' | 'reflection' | 'record'
  created_at: string
  is_anonymous?: boolean
  authorName: string
  authorAvatar: string | null
  authorChurch: string
  authorStreak?: number
  prayerMins?: number
  studyMins?: number
  reactions?: Record<string, { count: number; userReacted: boolean }>
  commentCount: number
}

function extractMinsFromContent(content: string): { prayerMins: number; studyMins: number } {
  let prayerMins = 0
  let studyMins = 0
  if (!content) return { prayerMins, studyMins }

  const prayerMatch = content.match(/(\d+)\s*m(?:in)?s?\s*(?:of\s*)?prayer/i)
  if (prayerMatch) prayerMins = parseInt(prayerMatch[1], 10)

  const studyMatch = content.match(/(\d+)\s*m(?:in)?s?\s*(?:of\s*)?(?:scripture\s*study|study|word)/i)
  if (studyMatch) studyMins = parseInt(studyMatch[1], 10)

  return { prayerMins, studyMins }
}

export async function fetchSquarePosts(): Promise<SquarePostItem[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let dbPosts: any[] | null = null

  // 1. Try fetching with foreign profile join
  const { data: primaryData, error: primaryErr } = await (supabase
    .from('square_posts') as any)
    .select(`
      *,
      profiles (
        display_name,
        avatar_url,
        church
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!primaryErr && primaryData && primaryData.length > 0) {
    dbPosts = primaryData
  } else {
    // 2. Fallback: Direct select from square_posts without join
    const { data: fallbackData } = await (supabase
      .from('square_posts') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    dbPosts = fallbackData || []
  }

  if (!dbPosts || dbPosts.length === 0) return []

  const postIds = dbPosts.map((p: any) => p.id)

  // Fetch author profiles for rows where join wasn't present
  const authorMap: Record<string, { display_name?: string; avatar_url?: string; church?: string }> = {}
  const userIdsToFetch = Array.from(
    new Set(
      dbPosts
        .filter((p: any) => !p.profiles && p.user_id)
        .map((p: any) => p.user_id)
    )
  )

  if (userIdsToFetch.length > 0) {
    const { data: profileRows } = await (supabase
      .from('profiles') as any)
      .select('id, display_name, avatar_url, church')
      .in('id', userIdsToFetch)

    ;(profileRows || []).forEach((pr: any) => {
      authorMap[pr.id] = pr
    })
  }

  // Fetch Discord-Style Reactions
  const { data: reactions } = await supabase
    .from('square_reactions')
    .select('post_id, user_id, reaction_type')
    .in('post_id', postIds)

  const postReactionsMap: Record<
    string,
    Record<string, { count: number; userReacted: boolean }>
  > = {}

  ;(reactions || []).forEach((r: any) => {
    if (!postReactionsMap[r.post_id]) {
      postReactionsMap[r.post_id] = {}
    }
    const current = postReactionsMap[r.post_id][r.reaction_type] || {
      count: 0,
      userReacted: false,
    }
    postReactionsMap[r.post_id][r.reaction_type] = {
      count: current.count + 1,
      userReacted: current.userReacted || (user ? r.user_id === user.id : false),
    }
  })

  // Fetch Comment Counts
  const { data: commentRows } = await (supabase
    .from('square_comments') as any)
    .select('post_id')
    .in('post_id', postIds)

  const postCommentCountMap: Record<string, number> = {}
  ;(commentRows || []).forEach((c: any) => {
    postCommentCountMap[c.post_id] = (postCommentCountMap[c.post_id] || 0) + 1
  })

  let localAnonPosts: string[] = []
  try {
    if (typeof window !== 'undefined') {
      localAnonPosts = JSON.parse(localStorage.getItem('faithsync_anon_posts') || '[]')
    }
  } catch (_) {}

  // Calculate authentic streaks for distinct non-anonymous authors
  const streakMap: Record<string, number> = {}
  const distinctUserIds = Array.from(
    new Set(
      dbPosts
        .filter((p: any) => p.user_id && !p.is_anonymous)
        .map((p: any) => p.user_id)
    )
  )

  if (distinctUserIds.length > 0) {
    await Promise.all(
      distinctUserIds.map(async (uid) => {
        try {
          streakMap[uid] = await calculateUserStreak(uid, supabase)
        } catch {
          streakMap[uid] = 0
        }
      })
    )
  }

  return dbPosts.map((p: any) => {
    const author = p.profiles || authorMap[p.user_id] || {}
    const isAnon = Boolean(
      p.is_anonymous === true ||
      p.is_anonymous === 'true' ||
      p.is_anonymous === 1 ||
      p.is_anonymous === 't' ||
      localAnonPosts.includes(p.id)
    )
    const authorDisplayName = isAnon
      ? 'Anonymous Member'
      : author.display_name || (user && p.user_id === user.id ? user.user_metadata?.full_name || 'Me' : 'A Believer')
    const authorChurchName = isAnon ? 'Community Square' : (author.church || '')

    const { prayerMins: pMins, studyMins: sMins } = extractMinsFromContent(p.content || '')

    return {
      id: p.id,
      user_id: isAnon ? '' : p.user_id,
      author_id: p.user_id,
      content: p.content || '',
      verse_reference: p.verse_reference,
      scripture_reference: p.scripture_reference || p.verse_reference,
      scripture_version_id: p.scripture_version_id || 'web',
      post_type: p.post_type || 'reflection',
      created_at: p.created_at || new Date().toISOString(),
      is_anonymous: isAnon,
      authorName: authorDisplayName,
      authorAvatar: isAnon ? null : author.avatar_url || null,
      authorChurch: authorChurchName,
      authorStreak: isAnon ? 0 : (streakMap[p.user_id] || 0),
      prayerMins: pMins || (p.post_type === 'record' ? 15 : undefined),
      studyMins: sMins || undefined,
      reactions: postReactionsMap[p.id] || {},
      commentCount: postCommentCountMap[p.id] || 0,
    }
  })
}

export function useSquarePosts() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<SquarePostItem[]>(
    SQUARE_CACHE_KEY,
    fetchSquarePosts,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 8_000,
      keepPreviousData: true,
    }
  )

  return {
    posts: data || [],
    error,
    isLoading: isLoading && !data,
    isValidating,
    mutate,
  }
}

export function invalidateSquarePosts() {
  globalMutate(SQUARE_CACHE_KEY)
}
