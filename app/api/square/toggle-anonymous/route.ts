import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { postId, isAnonymous } = body

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update the post where user is author
    const { data: updated, error } = await (supabase
      .from('square_posts') as any)
      .update({ is_anonymous: Boolean(isAnonymous) })
      .eq('id', postId)
      .eq('user_id', user.id)
      .select('id, is_anonymous')
      .maybeSingle()

    if (error) {
      console.error('Server failed to toggle square post anonymity:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      postId,
      isAnonymous: Boolean(isAnonymous),
      updated,
    })
  } catch (err: any) {
    console.error('API toggle-anonymous error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
