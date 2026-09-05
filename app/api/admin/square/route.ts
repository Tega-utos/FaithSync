import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifySuperAdmin } from '@/lib/admin/adminAuth'

// GET: List recent Square posts with real author details for moderation audit
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { user, isAuthorized } = await verifySuperAdmin(supabase)

    if (!isAuthorized || !user) {
      return NextResponse.json({ error: 'Forbidden: Super Admin Access Required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const query = searchParams.get('q') || ''

    let dbQuery = (supabase.from('square_posts') as any)
      .select(`
        id,
        user_id,
        session_id,
        content,
        verse_reference,
        post_type,
        is_anonymous,
        created_at,
        profiles:user_id(id, display_name, full_name, church, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (query.trim()) {
      dbQuery = dbQuery.ilike('content', `%${query.trim()}%`)
    }

    const { data: posts, error } = await dbQuery

    if (error) throw error

    return NextResponse.json({ success: true, posts: posts || [] })
  } catch (err: any) {
    console.error('Admin square fetch error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}

// DELETE: Super Admin one-tap removal of any post
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { user, isAuthorized } = await verifySuperAdmin(supabase)

    if (!isAuthorized || !user) {
      return NextResponse.json({ error: 'Forbidden: Super Admin Access Required' }, { status: 403 })
    }

    const body = await req.json()
    const { postId } = body

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    }

    // Delete post unconditionally (Super Admin override)
    const { error } = await (supabase.from('square_posts') as any)
      .delete()
      .eq('id', postId)

    if (error) throw error

    return NextResponse.json({ success: true, deletedPostId: postId })
  } catch (err: any) {
    console.error('Admin square delete error:', err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
