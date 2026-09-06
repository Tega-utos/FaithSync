import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const body = await req.json()
    const { postId, reactionType } = body

    if (!postId || !reactionType) {
      return NextResponse.json({ error: 'postId and reactionType are required.' }, { status: 400 })
    }

    // 1. Check existing reactions by this user for this post (enforce 1 reaction per user rule)
    const { data: existingReactions } = await (supabase
      .from('square_reactions') as any)
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', user.id)

    const existingMatch = (existingReactions || []).find((r: any) => r.reaction_type === reactionType)

    if (existingMatch) {
      // User tapped the same reaction again -> Remove it (toggle off)
      await (supabase
        .from('square_reactions') as any)
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)

      return NextResponse.json({
        success: true,
        action: 'removed',
        reactionType,
      })
    }

    // User tapped a new/different reaction -> Clear any previous reaction first, then insert new one
    await (supabase
      .from('square_reactions') as any)
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id)

    const { data: newReaction, error: insertError } = await (supabase
      .from('square_reactions') as any)
      .insert({
        post_id: postId,
        user_id: user.id,
        reaction_type: reactionType,
      })
      .select('*')
      .maybeSingle()

    if (insertError) {
      console.warn('Square reaction insert error:', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      action: 'added',
      reactionType,
      reaction: newReaction,
    })
  } catch (error: any) {
    console.error('Square reaction API error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to toggle reaction' },
      { status: 500 }
    )
  }
}
