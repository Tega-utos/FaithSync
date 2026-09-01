import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, includeReflection, customReflection } = await req.json()

    // 1. Fetch and verify session ownership
    let sessionData: any = null

    if (sessionId && sessionId !== 'temp' && sessionId !== 'latest') {
      const { data: foundSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (foundSession) {
        sessionData = foundSession
        // Flip shared_to_square to true
        await supabase
          .from('sessions')
          .update({ shared_to_square: true })
          .eq('id', sessionId)
      }
    }

    // 2. Calculate User Current Streak from past sessions
    const { data: allUserSessions } = await supabase
      .from('sessions')
      .select('started_at, created_at')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    const uniqueDays = new Set<string>()
    ;(allUserSessions || []).forEach((s) => {
      const dateStr = new Date(s.started_at || s.created_at).toISOString().split('T')[0]
      uniqueDays.add(dateStr)
    })
    uniqueDays.add(new Date().toISOString().split('T')[0])

    const streakCount = Math.max(1, uniqueDays.size)

    // 3. Extract Session Durations
    const durationSeconds = sessionData?.duration_seconds || 15 * 60
    const minutes = Math.max(1, Math.round(durationSeconds / 60))
    const discipline = sessionData?.type || 'prayer'

    const prayerMinutes = discipline === 'prayer' ? minutes : 0
    const studyMinutes = discipline === 'study' || discipline === 'word' ? minutes : 0

    // 4. Construct Content: Reflection if toggled, or standardized proof text
    const defaultProofText = `Completed ${minutes}m of ${discipline === 'prayer' ? 'Prayer' : 'Scripture Study'} 🙏`
    const finalContent = includeReflection
      ? (customReflection?.trim() || sessionData?.reflection?.trim() || defaultProofText)
      : defaultProofText

    // 5. Publish to square_posts as RECORD post
    const { data: newPost, error: postErr } = await supabase
      .from('square_posts')
      .insert({
        user_id: user.id,
        session_id: sessionData?.id || null,
        content: finalContent,
        verse_reference: includeReflection ? (sessionData?.verse_reference || null) : null,
        scripture_reference: includeReflection ? (sessionData?.verse_reference || null) : null,
        post_type: 'record',
      })
      .select()
      .single()

    if (postErr) {
      console.error('Error inserting square post:', postErr)
    }

    return NextResponse.json({
      success: true,
      postId: newPost?.id,
      streakCount,
      prayerMinutes,
      studyMinutes,
    })
  } catch (err: any) {
    console.error('Share session error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
