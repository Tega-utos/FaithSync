import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateUserStreak } from '@/lib/utils/streak'

async function getAuthenticatedUser(req: NextRequest | Request, supabase: any) {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const { data: userData } = await supabase.auth.getUser(token)
    if (userData?.user) return userData.user
  }
  const { data: userData } = await supabase.auth.getUser()
  return userData?.user || null
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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const currentUser = await getAuthenticatedUser(req, supabase)

    // 1. Fetch recent square posts
    const { data: posts, error: postsError } = await (supabase
      .from('square_posts') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60)

    if (postsError) {
      console.error('Failed to fetch square posts:', postsError)
      throw postsError
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ success: true, posts: [] })
    }

    const postIds = posts.map((p: any) => p.id)
    const userIds = Array.from(new Set(posts.map((p: any) => p.user_id).filter(Boolean)))

    // 2. Fetch profiles for authors with comprehensive name fields
    const profileMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: profileRows, error: profileErr } = await (supabase
        .from('profiles') as any)
        .select('id, display_name, full_name, username, avatar_url, church, email, preferences')
        .in('id', userIds)

      if (!profileErr && profileRows) {
        profileRows.forEach((pr: any) => {
          profileMap[pr.id] = pr
        })
      }
    }

    // 3. Fetch authentic user streaks
    const streakMap: Record<string, number> = {}
    if (userIds.length > 0) {
      await Promise.all(
        userIds.map(async (uid) => {
          try {
            streakMap[uid] = await calculateUserStreak(uid, supabase)
          } catch (streakErr) {
            streakMap[uid] = 0
          }
        })
      )
    }

    // 4. Fetch Reactions
    const postReactionsMap: Record<
      string,
      Record<string, { count: number; userReacted: boolean }>
    > = {}

    const { data: reactions } = await (supabase
      .from('square_reactions') as any)
      .select('post_id, user_id, reaction_type')
      .in('post_id', postIds)

    if (reactions && Array.isArray(reactions)) {
      reactions.forEach((r: any) => {
        if (!postReactionsMap[r.post_id]) {
          postReactionsMap[r.post_id] = {}
        }
        const current = postReactionsMap[r.post_id][r.reaction_type] || {
          count: 0,
          userReacted: false,
        }
        postReactionsMap[r.post_id][r.reaction_type] = {
          count: current.count + 1,
          userReacted: current.userReacted || (currentUser ? r.user_id === currentUser.id : false),
        }
      })
    }

    // 5. Fetch Comment Counts
    const postCommentCountMap: Record<string, number> = {}
    const { data: commentRows } = await (supabase
      .from('square_comments') as any)
      .select('post_id')
      .in('post_id', postIds)

    if (commentRows && Array.isArray(commentRows)) {
      commentRows.forEach((c: any) => {
        postCommentCountMap[c.post_id] = (postCommentCountMap[c.post_id] || 0) + 1
      })
    }

    // Helper: format clean display name
    const resolveAuthorName = (prof: any, isSelf: boolean) => {
      if (prof) {
        if (prof.display_name && prof.display_name.trim()) return prof.display_name.trim()
        if (prof.full_name && prof.full_name.trim()) return prof.full_name.trim()
        if (prof.username && prof.username.trim()) return prof.username.trim()
        if (prof.email && typeof prof.email === 'string' && prof.email.includes('@')) {
          const handle = prof.email.split('@')[0].replace(/[._-]+/g, ' ').trim()
          if (handle) {
            return handle
              .split(' ')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ')
          }
        }
      }
      if (isSelf && currentUser) {
        const meta = currentUser.user_metadata || {}
        if (meta.full_name && meta.full_name.trim()) return meta.full_name.trim()
        if (meta.name && meta.name.trim()) return meta.name.trim()
        if (meta.display_name && meta.display_name.trim()) return meta.display_name.trim()
        if (currentUser.email && typeof currentUser.email === 'string' && currentUser.email.includes('@')) {
          const handle = currentUser.email.split('@')[0].replace(/[._-]+/g, ' ').trim()
          if (handle) {
            return handle
              .split(' ')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ')
          }
        }
      }
      return 'Believer'
    }

    // 6. Format and enrich post items
    const enrichedPosts = posts.map((p: any) => {
      const isAnon = Boolean(
        p.is_anonymous === true ||
        p.is_anonymous === 'true' ||
        p.is_anonymous === 1 ||
        p.is_anonymous === 't'
      )

      const isSelf = Boolean(currentUser && p.user_id === currentUser.id)
      const prof = profileMap[p.user_id] || {}
      const authorName = isAnon ? 'Anonymous Member' : resolveAuthorName(prof, isSelf)
      const authorChurch = isAnon ? 'Community Square' : (prof.church || 'Local Assembly')
      const authorAvatar = isAnon ? null : (prof.avatar_url || (isSelf ? currentUser?.user_metadata?.avatar_url : null) || null)
      const authorStreak = isAnon ? 0 : (streakMap[p.user_id] ?? (prof.preferences?.admin_adjusted_streak ?? 0))

      const { prayerMins, studyMins } = extractMinsFromContent(p.content || '')

      return {
        id: p.id,
        user_id: isAnon ? '' : p.user_id,
        author_id: p.user_id,
        content: p.content || '',
        verse_reference: p.verse_reference || null,
        scripture_reference: p.scripture_reference || p.verse_reference || null,
        scripture_version_id: p.scripture_version_id || 'web',
        post_type: p.post_type || 'reflection',
        created_at: p.created_at || new Date().toISOString(),
        is_anonymous: isAnon,
        authorName,
        authorAvatar,
        authorChurch,
        authorStreak,
        prayerMins: prayerMins || (p.post_type === 'record' ? 15 : undefined),
        studyMins: studyMins || undefined,
        reactions: postReactionsMap[p.id] || {},
        commentCount: postCommentCountMap[p.id] || 0,
      }
    })

    return NextResponse.json({
      success: true,
      posts: enrichedPosts,
    })
  } catch (err: any) {
    console.error('Square feed API error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch feed' }, { status: 500 })
  }
}
