import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/admin/adminAuth'

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
    const body = await req.json()
    const { postId } = body

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const isAuthorizedAdmin = isSuperAdmin(user.email)

    // Check post ownership if not admin
    if (!isAuthorizedAdmin) {
      const { data: existingPost, error: checkError } = await (supabase
        .from('square_posts') as any)
        .select('id, user_id')
        .eq('id', postId)
        .maybeSingle()

      if (checkError) {
        console.error('Error verifying post ownership:', checkError)
      }

      if (existingPost && existingPost.user_id && existingPost.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete your own posts.' },
          { status: 403 }
        )
      }
    }

    // 1. Cascading deletion of dependent reactions & comments to prevent foreign key constraint violations
    try {
      await (supabase.from('square_reactions') as any).delete().eq('post_id', postId)
      await (supabase.from('square_comments') as any).delete().eq('post_id', postId)
    } catch (cascadeErr) {
      console.warn('Cascading delete warning (non-fatal):', cascadeErr)
    }

    // 2. Delete the post
    let query = (supabase.from('square_posts') as any).delete().eq('id', postId)
    if (!isAuthorizedAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { error: deleteError } = await query

    if (deleteError) {
      console.error('Server failed to delete square post:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, postId })
  } catch (err: any) {
    console.error('API delete post error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
