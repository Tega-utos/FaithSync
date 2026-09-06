import { createClient } from '@/lib/supabase/client'

export interface SquarePostItem {
  id: string
  user_id: string
  content: string
  verse_reference: string | null
  post_type: string
  created_at: string
  is_anonymous?: boolean
  authorName?: string
  authorAvatar?: string | null
  authorChurch?: string
  authorStreak?: number
  prayerMins?: number
  studyMins?: number
  amenCount: number
  hasAmened: boolean
  reactCount: number
  hasReacted: boolean
}

export async function fetchSquarePosts(currentUserId?: string): Promise<SquarePostItem[]> {
  const supabase = createClient()

  const { data: posts, error } = await (supabase
    .from('square_posts') as any)
    .select(`
      id,
      user_id,
      content,
      verse_reference,
      post_type,
      created_at,
      is_anonymous,
      profiles (id, display_name, full_name, username, avatar_url, church, email, preferences),
      square_reactions (user_id, reaction_type)
    `)
    .order('created_at', { ascending: false })

  if (error || !posts) return []

  return posts.map((p: any) => {
    const isAnon = Boolean(p.is_anonymous)
    const prof = p.profiles || {}
    const rawName = prof.display_name || prof.full_name || prof.username || (prof.email ? prof.email.split('@')[0] : 'Believer')
    const reactions = p.square_reactions || []
    const amenReactions = reactions.filter((r: any) => r.reaction_type === 'amen')
    const applaudReactions = reactions.filter((r: any) => r.reaction_type === 'applaud')

    const hasAmened = currentUserId ? amenReactions.some((r: any) => r.user_id === currentUserId) : false
    const hasReacted = currentUserId ? applaudReactions.some((r: any) => r.user_id === currentUserId) : false

    return {
      id: p.id,
      user_id: isAnon ? '' : p.user_id,
      content: p.content,
      verse_reference: p.verse_reference,
      post_type: p.post_type,
      created_at: p.created_at,
      is_anonymous: isAnon,
      authorName: isAnon ? 'Anonymous Member' : rawName,
      authorAvatar: isAnon ? null : prof.avatar_url,
      authorChurch: isAnon ? 'Community Square' : (prof.church || 'Local Assembly'),
      authorStreak: isAnon ? 0 : 7,
      amenCount: amenReactions.length,
      hasAmened,
      reactCount: applaudReactions.length,
      hasReacted,
    }
  })
}

export async function createSquarePost(
  content: string,
  postType: string = 'prayer',
  verseReference?: string
): Promise<SquarePostItem | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: newPost, error } = await (supabase
    .from('square_posts') as any)
    .insert({
      user_id: user.id,
      content,
      post_type: postType,
      verse_reference: verseReference || null,
    })
    .select(`
      id,
      user_id,
      content,
      verse_reference,
      post_type,
      created_at,
      profiles (display_name, avatar_url)
    `)
    .single()

  if (error || !newPost) return null

  return {
    id: newPost.id,
    user_id: newPost.user_id,
    content: newPost.content,
    verse_reference: newPost.verse_reference,
    post_type: newPost.post_type,
    created_at: newPost.created_at,
    authorName: (newPost as any).profiles?.display_name || user.user_metadata?.full_name || 'Me',
    authorAvatar: (newPost as any).profiles?.avatar_url,
    amenCount: 0,
    hasAmened: false,
    reactCount: 0,
    hasReacted: false,
  }
}
