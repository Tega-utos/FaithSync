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
    const { commentId } = body

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const user = await getAuthenticatedUser(req, supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const isAuthorizedAdmin = isSuperAdmin(user.email)

    // Check ownership if not admin
    if (!isAuthorizedAdmin) {
      const { data: existingComment } = await (supabase
        .from('square_comments') as any)
        .select('id, user_id, post_id')
        .eq('id', commentId)
        .maybeSingle()

      if (existingComment && existingComment.user_id && existingComment.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete your own comments.' },
          { status: 403 }
        )
      }
    }

    let query = (supabase.from('square_comments') as any).delete().eq('id', commentId)
    if (!isAuthorizedAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { error } = await query

    if (error) {
      console.error('Server failed to delete comment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, commentId })
  } catch (err: any) {
    console.error('API delete comment error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
