'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Globe,
  Plus,
  Fire,
  BookOpen,
  Sparkle,
  ShieldWarning,
  X,
  CaretRight,
  CaretLeft,
  PaperPlaneTilt,
  CircleNotch,
  Check,
  UserPlus,
  Clock,
  Smiley,
  Quotes,
  HandsPraying,
  WarningCircle,
  User,
  DotsThreeVertical,
  Trash,
  EyeSlash,
  Eye,
  ChatCircle,
  ChatCircleDots,
  Heart,
  Sun,
  Lightbulb,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { ScripturePicker, ScriptureSelection } from '@/components/scripture/ScripturePicker'
import { ScriptureText } from '@/components/scripture/ScriptureText'

type FilterType = 'all' | 'prayers' | 'struggles' | 'testimonies' | 'records'
type IntentType = 'prayer' | 'struggle' | 'testimony' | 'record'

export const FAITH_REACTIONS = [
  { key: 'amen', label: 'Amen', Icon: HandsPraying, color: 'text-[#234537]' },
  { key: 'fire', label: 'Spirit', Icon: Fire, color: 'text-[#234537]' },
  { key: 'heart', label: 'Love', Icon: Heart, color: 'text-rose-500' },
  { key: 'praise', label: 'Praise', Icon: Sparkle, color: 'text-[#FBBF24]' },
  { key: 'peace', label: 'Peace', Icon: Sun, color: 'text-amber-500' },
  { key: 'light', label: 'Insight', Icon: Lightbulb, color: 'text-amber-500' },
]

function parsePostContent(rawContent: string) {
  if (!rawContent) return { title: null, body: '' }
  const boldMatch = rawContent.match(/^\*\*(.+?)\*\*\n\n?([\s\S]*)$/)
  if (boldMatch) {
    return { title: boldMatch[1].trim(), body: boldMatch[2].trim() }
  }
  const headingMatch = rawContent.match(/^##?\s+(.+?)\n\n?([\s\S]*)$/)
  if (headingMatch) {
    return { title: headingMatch[1].trim(), body: headingMatch[2].trim() }
  }
  return { title: null, body: rawContent }
}

export interface SquareCommentItem {
  id: string
  post_id: string
  user_id: string
  content: string
  is_anonymous: boolean
  authorName: string
  authorAvatar: string | null
  authorChurch: string
  created_at: string
}

interface SquarePostItem {
  id: string
  user_id: string
  author_id?: string
  content: string
  verse_reference: string | null
  scripture_reference?: string | null
  scripture_version_id?: string | null
  post_type: string
  created_at: string
  is_anonymous?: boolean
  title?: string
  authorName?: string
  authorAvatar?: string | null
  authorChurch?: string
  authorStreak?: number
  prayerMins?: number
  studyMins?: number
  reactions: Record<string, { count: number; userReacted: boolean }>
  commentCount: number
}

import { getMemoryCache, setMemoryCache } from '@/lib/cache/clientCache'

function SquarePageContent() {
  const router = useRouter()

  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [posts, setPosts] = useState<SquarePostItem[]>(() => {
    return getMemoryCache<SquarePostItem[]>('square_feed_posts') || []
  })
  const [loading, setLoading] = useState(() => {
    return !getMemoryCache<SquarePostItem[]>('square_feed_posts')
  })
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [composeStep, setComposeStep] = useState<'intent' | 'draft'>('intent')
  const [selectedIntent, setSelectedIntent] = useState<IntentType>('prayer')
  const [postTitle, setPostTitle] = useState('')
  const [postContent, setPostContent] = useState('')
  const [attachedScripture, setAttachedScripture] = useState<ScriptureSelection | null>(null)
  const [isScripturePickerOpen, setIsScripturePickerOpen] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submittingPost, setSubmittingPost] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)

  // Connect Modal State (Peer-to-Peer 140 char message)
  const [connectModalPost, setConnectModalPost] = useState<SquarePostItem | null>(null)
  const [connectMessage, setConnectMessage] = useState('')
  const [sendingConnectRequest, setSendingConnectRequest] = useState(false)
  const [connectSent, setConnectSent] = useState(false)

  const searchParams = useSearchParams()

  // Handle incoming share parameters from Homepage Verse of the Day
  useEffect(() => {
    if (!searchParams) return
    const shouldCompose = searchParams.get('compose') === 'true'
    const verseParam = searchParams.get('verse')
    const refParam = searchParams.get('ref') || searchParams.get('reference')
    const intentParam = searchParams.get('intent')

    if (shouldCompose || verseParam) {
      setIsComposeOpen(true)
      if (intentParam && ['prayer', 'struggle', 'testimony', 'record'].includes(intentParam)) {
        setSelectedIntent(intentParam as IntentType)
      } else {
        setSelectedIntent('record')
      }
      setComposeStep('draft')

      if (verseParam) {
        setPostTitle(refParam ? `Reflection on ${refParam}` : 'Verse of the Day Reflection')
        setPostContent(`${verseParam}\n\nMy Reflection:\n`)
      }
    }
  }, [searchParams])

  useEffect(() => {
    async function loadSquarePosts() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setCurrentUser(user)

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

        if (dbPosts && dbPosts.length > 0) {
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

          const formatted: SquarePostItem[] = dbPosts.map((p: any) => {
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
            const authorChurchName = isAnon ? 'Community Square' : (author.church || 'Local Assembly')

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
              authorStreak: 14,
              prayerMins: 30,
              studyMins: 20,
              reactions: postReactionsMap[p.id] || {},
              commentCount: postCommentCountMap[p.id] || 0,
            }
          })

          setPosts(formatted)
          setMemoryCache('square_feed_posts', formatted)
        } else {
          setPosts([])
        }
      } catch (err) {
        console.error('Square load error:', err)
        setPosts([])
      } finally {
        setLoading(false)
      }
    }

    loadSquarePosts()
  }, [])

  // Discord-Style Reactions State & Handlers
  const [openReactionPickerPostId, setOpenReactionPickerPostId] = useState<string | null>(null)

  const handleToggleReaction = async (postId: string, reactionKey: string) => {
    if (!currentUser) {
      router.push('/login')
      return
    }

    setOpenReactionPickerPostId(null)

    let wasReacted = false
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        const currentData = p.reactions?.[reactionKey] || { count: 0, userReacted: false }
        wasReacted = currentData.userReacted
        const nextReacted = !wasReacted
        const nextCount = nextReacted ? currentData.count + 1 : Math.max(0, currentData.count - 1)

        return {
          ...p,
          reactions: {
            ...p.reactions,
            [reactionKey]: {
              count: nextCount,
              userReacted: nextReacted,
            },
          },
        }
      })
    )

    try {
      const supabase = createClient()
      if (wasReacted) {
        await supabase
          .from('square_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id)
          .eq('reaction_type', reactionKey)
      } else {
        await (supabase.from('square_reactions') as any).upsert(
          {
            post_id: postId,
            user_id: currentUser.id,
            reaction_type: reactionKey,
          },
          { onConflict: 'post_id,user_id,reaction_type' }
        )
      }
    } catch (err) {
      console.error('Reaction toggle error:', err)
    }
  }

  // Comments State & Handlers
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null)
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, SquareCommentItem[]>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({})
  const [newCommentAnonymous, setNewCommentAnonymous] = useState<Record<string, boolean>>({})
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({})

  const handleToggleComments = async (postId: string) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null)
      return
    }

    setOpenCommentsPostId(postId)

    if (!commentsByPostId[postId]) {
      setLoadingComments((prev) => ({ ...prev, [postId]: true }))
      try {
        const supabase = createClient()
        const { data: comments, error } = await (supabase
          .from('square_comments') as any)
          .select(`
            *,
            profiles (
              display_name,
              avatar_url,
              church
            )
          `)
          .eq('post_id', postId)
          .order('created_at', { ascending: true })

        if (!error && comments) {
          const formatted: SquareCommentItem[] = comments.map((c: any) => {
            const isAnon = Boolean(c.is_anonymous)
            const p = c.profiles || {}
            return {
              id: c.id,
              post_id: c.post_id,
              user_id: isAnon ? '' : c.user_id,
              content: c.content,
              is_anonymous: isAnon,
              authorName: isAnon ? 'Anonymous Member' : p.display_name || 'Believer',
              authorAvatar: isAnon ? null : p.avatar_url || null,
              authorChurch: isAnon ? 'Community Square' : p.church || 'Local Assembly',
              created_at: c.created_at,
            }
          })
          setCommentsByPostId((prev) => ({ ...prev, [postId]: formatted }))
        } else {
          setCommentsByPostId((prev) => ({ ...prev, [postId]: [] }))
        }
      } catch (err) {
        console.error('Failed to load comments:', err)
        setCommentsByPostId((prev) => ({ ...prev, [postId]: [] }))
      } finally {
        setLoadingComments((prev) => ({ ...prev, [postId]: false }))
      }
    }
  }

  const handleSendComment = async (postId: string) => {
    const text = (newCommentText[postId] || '').trim()
    if (!text) return

    if (!currentUser) {
      router.push('/login')
      return
    }

    const isAnon = Boolean(newCommentAnonymous[postId])
    const tempId = `cmt-${Date.now()}`

    const optimisticComment: SquareCommentItem = {
      id: tempId,
      post_id: postId,
      user_id: isAnon ? '' : currentUser.id,
      content: text,
      is_anonymous: isAnon,
      authorName: isAnon
        ? 'Anonymous Member'
        : currentUser.user_metadata?.full_name || currentUser.user_metadata?.display_name || 'Believer',
      authorAvatar: isAnon ? null : currentUser.user_metadata?.avatar_url || null,
      authorChurch: isAnon ? 'Community Square' : currentUser.user_metadata?.church || 'Local Assembly',
      created_at: new Date().toISOString(),
    }

    setCommentsByPostId((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), optimisticComment],
    }))
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p))
    )
    setNewCommentText((prev) => ({ ...prev, [postId]: '' }))
    setSubmittingComment((prev) => ({ ...prev, [postId]: true }))

    try {
      const supabase = createClient()
      const { data: inserted } = await (supabase
        .from('square_comments') as any)
        .insert({
          post_id: postId,
          user_id: currentUser.id,
          content: text,
          is_anonymous: isAnon,
        })
        .select('id')
        .maybeSingle()

      if (inserted) {
        setCommentsByPostId((prev) => ({
          ...prev,
          [postId]: (prev[postId] || []).map((c) => (c.id === tempId ? { ...c, id: inserted.id } : c)),
        }))
      }
    } catch (err) {
      console.error('Failed to submit comment:', err)
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }))
    }
  }

  // Author Post Management (Toggle Anonymity & Delete)
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null)

  const handleToggleAnonymous = async (postId: string, currentIsAnon: boolean) => {
    const nextIsAnon = !currentIsAnon
    setActiveMenuPostId(null)

    // 1. Sync to local storage for immediate unbreakable persistence
    try {
      if (typeof window !== 'undefined') {
        const stored: string[] = JSON.parse(localStorage.getItem('faithsync_anon_posts') || '[]')
        const updated = nextIsAnon
          ? Array.from(new Set([...stored, postId]))
          : stored.filter((id) => id !== postId)
        localStorage.setItem('faithsync_anon_posts', JSON.stringify(updated))
      }
    } catch (_) {}

    // 2. Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        return {
          ...p,
          is_anonymous: nextIsAnon,
          authorName: nextIsAnon
            ? 'Anonymous Member'
            : currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.display_name || 'Believer',
          authorAvatar: nextIsAnon ? null : currentUser?.user_metadata?.avatar_url || null,
          authorChurch: nextIsAnon ? 'Community Square' : (currentUser?.user_metadata?.church || 'Local Assembly'),
        }
      })
    )

    // 3. Persist via Server API Route & Client Supabase
    try {
      await fetch('/api/square/toggle-anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, isAnonymous: nextIsAnon }),
      })
      const supabase = createClient()
      await (supabase.from('square_posts') as any)
        .update({ is_anonymous: nextIsAnon })
        .eq('id', postId)
    } catch (err) {
      console.error('Failed to update anonymity:', err)
    }
  }

  const handleDeletePost = async (postId: string) => {
    setActiveMenuPostId(null)
    setPosts((prev) => prev.filter((p) => p.id !== postId))

    try {
      if (typeof window !== 'undefined') {
        const stored: string[] = JSON.parse(localStorage.getItem('faithsync_anon_posts') || '[]')
        localStorage.setItem('faithsync_anon_posts', JSON.stringify(stored.filter((id) => id !== postId)))
      }
    } catch (_) {}

    try {
      await fetch('/api/square/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const supabase = createClient()
      await (supabase.from('square_posts') as any).delete().eq('id', postId)
    } catch (err) {
      console.error('Failed to delete post:', err)
    }
  }

  // Compose Submission
  const handleOpenCompose = () => {
    if (!currentUser) {
      router.push('/login')
      return
    }
    setPostError(null)
    setComposeStep('intent')
    setSelectedIntent('prayer')
    setPostTitle('')
    setPostContent('')
    setAttachedScripture(null)
    setIsAnonymous(false)
    setIsComposeOpen(true)
  }

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postContent.trim()) return

    setSubmittingPost(true)
    setPostError(null)
    try {
      const supabase = createClient()
      let user = currentUser
      if (!user) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        user = authUser
        if (authUser) setCurrentUser(authUser)
      }

      if (!user) {
        setPostError('You must be logged in to publish a post.')
        router.push('/login')
        return
      }

      const combinedContent = postTitle.trim()
        ? `**${postTitle.trim()}**\n\n${postContent.trim()}`
        : postContent.trim()

      const normalizedPostType =
        selectedIntent === 'prayer'
          ? 'prayer_request'
          : selectedIntent === 'struggle'
          ? 'struggle'
          : selectedIntent === 'testimony'
          ? 'testimony'
          : 'record'

      let newPostId: string | null = null

      // Tier 1: Full insert with all extended schema fields
      const { data: newPost, error: insertError } = await supabase
        .from('square_posts')
        .insert({
          user_id: user.id,
          content: combinedContent,
          post_type: normalizedPostType,
          is_anonymous: isAnonymous,
          scripture_reference: attachedScripture?.reference || null,
          scripture_version_id: attachedScripture?.versionId || null,
          verse_reference: attachedScripture?.reference || null,
        })
        .select('id')
        .maybeSingle()

      if (insertError) {
        console.warn('Tier 1 insert note, trying Tier 2 baseline insert:', insertError.message)
        // Tier 2: Baseline insert with core columns
        const { data: fallbackPost, error: fallbackError } = await supabase
          .from('square_posts')
          .insert({
            user_id: user.id,
            content: combinedContent,
            post_type: normalizedPostType,
            is_anonymous: Boolean(isAnonymous),
            verse_reference: attachedScripture?.reference || null,
          })
          .select('id')
          .maybeSingle()

        if (fallbackError) {
          console.warn('Tier 2 insert note, trying Tier 3 fallback with reflection type:', fallbackError.message)
          // Tier 3: If legacy check constraint rejects post_type, insert as reflection
          const { data: tier3Post, error: tier3Error } = await supabase
            .from('square_posts')
            .insert({
              user_id: user.id,
              content: combinedContent,
              post_type: 'reflection',
              is_anonymous: Boolean(isAnonymous),
              verse_reference: attachedScripture?.reference || null,
            })
            .select('id')
            .maybeSingle()

          if (tier3Error) {
            throw tier3Error
          }
          newPostId = tier3Post?.id || `sp-${Date.now()}`
        } else {
          newPostId = fallbackPost?.id || `sp-${Date.now()}`
        }
      } else {
        newPostId = newPost?.id || `sp-${Date.now()}`
      }

      const optimisticPost: SquarePostItem = {
        id: newPostId,
        user_id: isAnonymous ? '' : user.id,
        content: combinedContent,
        verse_reference: attachedScripture?.reference || null,
        scripture_reference: attachedScripture?.reference || null,
        scripture_version_id: attachedScripture?.versionId || 'web',
        post_type: normalizedPostType,
        created_at: new Date().toISOString(),
        is_anonymous: Boolean(isAnonymous),
        authorName: isAnonymous
          ? 'Anonymous Member'
          : user.user_metadata?.full_name || user.user_metadata?.display_name || 'Believer',
        authorAvatar: isAnonymous ? null : user.user_metadata?.avatar_url,
        authorChurch: isAnonymous ? 'Community Square' : (user.user_metadata?.church || 'Assembly of Christ'),
        authorStreak: 14,
        prayerMins: 30,
        reactions: {},
        commentCount: 0,
      }

      setPosts((prev) => [optimisticPost, ...prev])
      setIsComposeOpen(false)
      setPostTitle('')
      setPostContent('')
      setAttachedScripture(null)
      setIsAnonymous(false)
    } catch (err: any) {
      console.error('Failed to publish square post:', err)
      setPostError(err?.message || 'Failed to publish post. Please check your connection and try again.')
    } finally {
      setSubmittingPost(false)
    }
  }

  // Peer-to-Peer Connect Flow
  const handleSendConnectRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connectModalPost || !currentUser || !connectMessage.trim()) return

    setSendingConnectRequest(true)
    try {
      const supabase = createClient()
      const targetUserId = connectModalPost.author_id || connectModalPost.user_id

      if (!targetUserId) throw new Error('Target believer ID missing.')

      // 1. Create pending connection with Square Connection type
      const { data: conn, error: connErr } = await (supabase
        .from('buddies') as any)
        .insert({
          user_id: currentUser.id,
          buddy_id: targetUserId,
          status: 'pending',
          connection_type: 'square',
        })
        .select()
        .single()

      if (connErr) console.warn('Connection record note:', connErr.message)

      // 2. Dispatch direct intro message
      await (supabase.from('messages') as any).insert({
        sender_id: currentUser.id,
        recipient_id: targetUserId,
        content: connectMessage.trim(),
        message_type: 'text',
      })

      // 3. Dispatch alert notification to recipient
      await (supabase.from('notifications') as any).insert({
        user_id: targetUserId,
        sender_id: currentUser.id,
        type: 'buddy_request',
        title: currentUser.user_metadata?.full_name || 'A Believer',
        text: `Sent you a connection request from the Square: "${connectMessage.trim().slice(0, 60)}..."`,
        route_url: '/sync',
      })

      setConnectSent(true)
      setTimeout(() => {
        setConnectModalPost(null)
        setConnectSent(false)
        setConnectMessage('')
      }, 1800)
    } catch (err) {
      console.error('Connect request error:', err)
    } finally {
      setSendingConnectRequest(false)
    }
  }

  // Filter Logic with 30-Day Expiration Rule
  const filteredPosts = posts.filter((p) => {
    // 30-Day Expiration Rule: Prayers and Struggles expire after 30 days. Testimonies and Records are Permanent.
    const isExpiringType =
      p.post_type === 'prayer' || p.post_type === 'prayer_request' || p.post_type === 'struggle'
    if (isExpiringType && p.created_at) {
      const ageMs = Date.now() - new Date(p.created_at).getTime()
      if (ageMs > 30 * 24 * 60 * 60 * 1000) {
        return false
      }
    }

    if (activeFilter === 'all') return true
    if (activeFilter === 'prayers') return p.post_type === 'prayer' || p.post_type === 'prayer_request'
    if (activeFilter === 'struggles') return p.post_type === 'struggle'
    if (activeFilter === 'testimonies') return p.post_type === 'testimony'
    if (activeFilter === 'records') return p.post_type === 'reflection' || p.post_type === 'record'
    return true
  })

  const charLimit = selectedIntent === 'prayer' ? 140 : 280
  const charsRemaining = charLimit - postContent.length

  return (
    <div className="command-center-container px-4 sm:px-6 pt-3 pb-20 space-y-4">
      {/* Top Header / Back Navigation */}
      <div className="flex items-center justify-between pb-1 border-b border-[#E5E7EB]/60">
        <Link
          href="/sync"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#0E0E0E] hover:border-[#FBBF24] transition-all group shadow-2xs active:scale-95"
        >
          <CaretLeft size={16} weight="bold" className="text-[#FBBF24] group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to SynC</span>
        </Link>

        <span className="text-[11px] font-bold text-[#707070] uppercase tracking-wider">
          Community Feed
        </span>
      </div>

      {/* Hero Section */}
      <div className="space-y-1 pb-1">
        <div className="flex items-center gap-2">
          <Globe size={20} className="text-[#FBBF24]" />
          <h1 className="text-xl sm:text-2xl font-black text-[#0E0E0E] tracking-tight">
            Community Square
          </h1>
        </div>
        <p className="text-xs text-[#707070] leading-relaxed">
          A shared sanctuary for collective reflection and fellowship.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 min-w-max">
          {[
            { id: 'all', label: 'All Entries' },
            { id: 'prayers', label: 'Prayers' },
            { id: 'struggles', label: 'Struggles' },
            { id: 'testimonies', label: 'Testimonies' },
            { id: 'records', label: 'Records' },
          ].map((tab) => {
            const isActive = activeFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as FilterType)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#FBBF24] text-white shadow-sm'
                    : 'bg-white border border-[#E5E7EB] text-[#707070] hover:border-[#FBBF24]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Feed Content or Empty State */}
      {loading ? (
        <div className="py-20 text-center text-xs text-[#707070]">Loading reflections...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="faith-card p-8 text-center flex flex-col items-center justify-center space-y-3 my-6">
          <div className="w-14 h-14 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/35 text-[#FBBF24] flex items-center justify-center">
            <Globe size={28} />
          </div>
          <div className="space-y-1 max-w-xs">
            <h2 className="text-sm font-bold text-[#0E0E0E]">The square is quiet</h2>
            <p className="text-xs text-[#707070] leading-relaxed">
              Be the first to share your journey, request prayer, or celebrate what God has done.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCompose}
            className="bg-[#0E0E0E] text-white py-3 px-6 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all"
          >
            Write a Post
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPosts.map((post) => {
            const isPrayer = post.post_type === 'prayer' || post.post_type === 'prayer_request'
            const isStruggle = post.post_type === 'struggle'
            const isTestimony = post.post_type === 'testimony'
            const isRecord = post.post_type === 'reflection' || post.post_type === 'record'

            const timeStr = new Date(post.created_at).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            })

            const canConnect =
              (isPrayer || isStruggle) &&
              currentUser &&
              currentUser.id !== post.user_id &&
              !post.is_anonymous

            return (
              <div key={post.id} className="faith-card p-4 sm:p-5 space-y-3.5">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  {post.is_anonymous ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#FAF6EE] text-[#707070] border border-[#E5E7EB] font-bold text-xs flex items-center justify-center shadow-2xs">
                        <User size={18} weight="bold" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#0E0E0E]">
                          Anonymous Member
                        </p>
                        <p className="text-[10px] text-[#707070]">
                          Community Square • {timeStr}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#0E0E0E] text-white font-bold text-xs flex items-center justify-center border border-white shadow-sm overflow-hidden">
                        {post.authorAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.authorAvatar}
                            alt={post.authorName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{post.authorName?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0E0E0E]">
                          {post.authorName}
                        </p>
                        <p className="text-[10px] text-[#707070]">
                          {post.authorChurch} • {timeStr}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {isPrayer ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EBF3EE] border border-[#234537]/25 text-[#234537] text-[10px] font-bold inline-flex items-center gap-1">
                        <HandsPraying size={12} weight="fill" />
                        <span>Prayer</span>
                      </span>
                    ) : isStruggle ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#262626] text-[10px] font-bold inline-flex items-center gap-1">
                        <ShieldWarning size={12} />
                        <span>Struggle</span>
                      </span>
                    ) : isTestimony ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FDF9F1] border border-[#FBBF24]/35 text-[#FBBF24] text-[10px] font-bold inline-flex items-center gap-1">
                        <Sparkle size={12} weight="fill" />
                        <span>Testimony</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6EE] border border-[#E5E7EB] text-[#707070] text-[10px] font-bold inline-flex items-center gap-1">
                        <Clock size={12} />
                        <span>Record</span>
                      </span>
                    )}

                    {currentUser &&
                      (post.author_id === currentUser.id ||
                        post.user_id === currentUser.id ||
                        !post.user_id) && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuPostId((prev) => (prev === post.id ? null : post.id))
                          }
                          className="p-1 rounded-lg text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6] transition-colors"
                          title="Post options"
                        >
                          <DotsThreeVertical size={16} weight="bold" />
                        </button>

                        {activeMenuPostId === post.id && (
                          <div className="absolute right-0 top-7 z-20 w-44 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                            <button
                              type="button"
                              onClick={() => handleToggleAnonymous(post.id, Boolean(post.is_anonymous))}
                              className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-bold text-[#0E0E0E] hover:bg-[#FAF6EE] flex items-center gap-2 transition-colors"
                            >
                              {post.is_anonymous ? (
                                <>
                                  <Eye size={14} className="text-[#FBBF24]" />
                                  <span>Show My Name</span>
                                </>
                              ) : (
                                <>
                                  <EyeSlash size={14} className="text-[#234537]" />
                                  <span>Make Anonymous</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeletePost(post.id)}
                              className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                            >
                              <Trash size={14} />
                              <span>Delete Post</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Session Record Proof of Work Card */}
                {isRecord ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-3 shadow-inner">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#707070] block">
                        Daily Clock-In Proof
                      </span>

                      {/* 2x2 Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-[#707070] block">Prayer</span>
                          <span className="text-sm font-extrabold font-mono text-[#FBBF24]">
                            {post.prayerMins || 30} mins
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] space-y-0.5">
                          <span className="text-[9px] font-bold uppercase text-[#707070] block">Study</span>
                          <span className="text-sm font-extrabold font-mono text-[#FBBF24]">
                            {post.studyMins || 20} mins
                          </span>
                        </div>
                      </div>

                      {/* All-Time Days Active Display */}
                      <div className="pt-2 border-t border-[#E5E7EB]/70 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#707070] uppercase tracking-wider">
                          All-Time Days Active
                        </span>
                        <div className="flex items-center gap-1">
                          <Fire size={16} weight="fill" className="text-[#234537]" />
                          <span className="text-base font-black font-mono text-[#234537]">
                            {post.authorStreak || 42} Days &amp; Counting
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Reflection with Solid Burnham Vertical Line on Left */}
                    {post.content && post.content.trim().length > 0 && (() => {
                      const { title, body } = parsePostContent(post.content)
                      return (
                        <div className="border-l-4 border-[#234537] pl-3 py-1 space-y-1">
                          {title && (
                            <h2 className="text-sm font-extrabold text-[#0E0E0E] tracking-tight not-italic">
                              {title}
                            </h2>
                          )}
                          {body && (
                            <p className="text-xs text-[#0E0E0E] italic leading-relaxed whitespace-pre-line">
                              &ldquo;{body}&rdquo;
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ) : (() => {
                  const { title, body } = parsePostContent(post.content)
                  return (
                    <div className="space-y-1.5">
                      {title && (
                        <h2 className="text-sm sm:text-base font-extrabold text-[#0E0E0E] tracking-tight">
                          {title}
                        </h2>
                      )}
                      {body && (
                        <p className="text-xs text-[#0E0E0E] leading-relaxed whitespace-pre-line">
                          {body}
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Attached Scripture Card */}
                {post.scripture_reference && (
                  <ScriptureText
                    reference={post.scripture_reference}
                    versionId={post.scripture_version_id || 'web'}
                    display="card"
                  />
                )}

                {/* Footer: Discord-Style Reactions & Comments */}
                <div className="pt-2 border-t border-[#F3F4F6] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Discord Reaction Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {FAITH_REACTIONS.map((r) => {
                        const reactionData = post.reactions?.[r.key]
                        if (!reactionData || reactionData.count <= 0) return null
                        const IconComponent = r.Icon

                        return (
                          <button
                            key={r.key}
                            type="button"
                            onClick={() => handleToggleReaction(post.id, r.key)}
                            className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                              reactionData.userReacted
                                ? 'bg-[#EBF3EE] border border-[#234537] text-[#234537] font-bold shadow-xs'
                                : 'bg-[#F9FAFB] border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F3F4F6] font-medium'
                            }`}
                            title={`React with ${r.label}`}
                          >
                            <IconComponent size={14} weight="fill" className={r.color} />
                            <span className="font-mono text-[11px] font-bold">
                              {reactionData.count}
                            </span>
                          </button>
                        )
                      })}

                      {/* Add Reaction Button (+ 😀) */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenReactionPickerPostId((prev) =>
                              prev === post.id ? null : post.id
                            )
                          }
                          className="px-2 py-1 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#FBBF24] hover:bg-white text-[#707070] text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                          title="Add faith reaction"
                        >
                          <Plus size={11} weight="bold" />
                          <Smiley size={14} />
                        </button>

                        {openReactionPickerPostId === post.id && (
                          <div className="absolute left-0 bottom-8 sm:bottom-auto sm:top-8 z-30 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-1.5 flex items-center gap-1 animate-in fade-in zoom-in-95">
                            {FAITH_REACTIONS.map((r) => {
                              const isSelected = Boolean(post.reactions?.[r.key]?.userReacted)
                              const IconComponent = r.Icon
                              return (
                                <button
                                  key={r.key}
                                  type="button"
                                  onClick={() => handleToggleReaction(post.id, r.key)}
                                  className={`p-2 rounded-xl hover:scale-125 transition-transform flex flex-col items-center gap-1 ${
                                    isSelected ? 'bg-[#EBF3EE]' : 'hover:bg-[#F9FAFB]'
                                  }`}
                                  title={r.label}
                                >
                                  <IconComponent size={16} weight="fill" className={r.color} />
                                  <span className="text-[9px] font-bold text-[#707070]">
                                    {r.label}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Connect Button: Present on every post EXCEPT record posts, anonymous posts, or own posts */}
                      {!post.is_anonymous &&
                        post.post_type !== 'record' &&
                        currentUser &&
                        post.author_id !== currentUser.id &&
                        post.user_id !== currentUser.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setConnectModalPost(post)
                              setConnectMessage('')
                              setConnectSent(false)
                            }}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#FAF6EE] text-[#0E0E0E] hover:bg-[#FAF6EE]/80 border border-[#E5E7EB] hover:border-[#FBBF24] transition-all flex items-center gap-1 active:scale-95 shadow-2xs cursor-pointer"
                            title="Connect with author via Square Chat"
                          >
                            <UserPlus size={14} className="text-[#FBBF24]" weight="bold" />
                            <span>Connect</span>
                          </button>
                        )}

                      {/* Comments Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleComments(post.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs cursor-pointer ${
                          openCommentsPostId === post.id
                            ? 'bg-[#0E0E0E] text-white'
                            : 'bg-[#FAF6EE] text-[#707070] hover:text-[#0E0E0E] hover:bg-[#F3F4F6]'
                        }`}
                      >
                        <ChatCircle size={15} weight="bold" />
                        <span>
                          {post.commentCount > 0
                            ? `${post.commentCount} ${
                                post.commentCount === 1 ? 'Comment' : 'Comments'
                              }`
                            : 'Comment'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable Comments Section */}
                  {openCommentsPostId === post.id && (
                    <div className="pt-3 border-t border-[#E5E7EB]/70 space-y-3 animate-in fade-in">
                      {/* Comments List */}
                      {loadingComments[post.id] ? (
                        <div className="py-4 flex items-center justify-center gap-2 text-xs text-[#707070]">
                          <CircleNotch size={16} className="animate-spin text-[#FBBF24]" />
                          <span>Loading encouragements...</span>
                        </div>
                      ) : (commentsByPostId[post.id] || []).length === 0 ? (
                        <div className="py-3 text-center text-xs text-[#707070] bg-[#FAF6EE]/60 rounded-xl">
                          No comments yet. Share an encouraging word or prayer!
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                          {(commentsByPostId[post.id] || []).map((comment) => (
                            <div
                              key={comment.id}
                              className="p-2.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]/80 space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-[#0E0E0E] text-white text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0">
                                    {comment.is_anonymous ? (
                                      <User size={12} weight="bold" />
                                    ) : comment.authorAvatar ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={comment.authorAvatar}
                                        alt={comment.authorName}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span>{comment.authorName?.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <span className="font-bold text-[#0E0E0E]">
                                    {comment.authorName}
                                  </span>
                                  {!comment.is_anonymous && (
                                    <span className="text-[9px] text-[#707070]">
                                      • {comment.authorChurch}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-[#707070]">
                                  {new Date(comment.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-[#262626] pl-6 leading-relaxed">
                                {comment.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment Input Form */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleSendComment(post.id)
                        }}
                        className="space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newCommentText[post.id] || ''}
                            onChange={(e) =>
                              setNewCommentText((prev) => ({
                                ...prev,
                                [post.id]: e.target.value,
                              }))
                            }
                            placeholder="Write an encouraging comment or prayer..."
                            className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] shadow-xs"
                          />
                          <button
                            type="submit"
                            disabled={
                              !(newCommentText[post.id] || '').trim() ||
                              submittingComment[post.id]
                            }
                            className="px-3.5 py-2 rounded-xl bg-[#234537] hover:bg-[#183329] text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                          >
                            {submittingComment[post.id] ? (
                              <CircleNotch size={14} className="animate-spin" />
                            ) : (
                              <>
                                <PaperPlaneTilt size={14} />
                                <span className="hidden sm:inline">Send</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[11px] font-medium text-[#707070]">Comment anonymously</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={Boolean(newCommentAnonymous[post.id])}
                            onClick={() =>
                              setNewCommentAnonymous((prev) => ({
                                ...prev,
                                [post.id]: !prev[post.id],
                              }))
                            }
                            className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer ${
                              newCommentAnonymous[post.id] ? 'bg-[#FBBF24]' : 'bg-[#E5E7EB]'
                            }`}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                                newCommentAnonymous[post.id] ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={handleOpenCompose}
        className="fixed bottom-6 right-5 sm:right-8 z-40 w-14 h-14 rounded-full bg-[#FBBF24] text-white shadow-[0_8px_30px_rgba(251,191,36,0.55)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center ring-4 ring-[#FBBF24]/20"
        title="Share to Square"
      >
        <Plus size={24} weight="bold" />
      </button>

      {/* Compose Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="fixed inset-0" onClick={() => setIsComposeOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-[#FAF6EE] border border-[#E5E7EB] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-sm font-bold text-[#0E0E0E]">Share to Square</h3>
                <p className="text-[10px] text-[#707070]">
                  {composeStep === 'intent'
                    ? 'Select a category for your post'
                    : `Drafting a ${
                        selectedIntent === 'prayer'
                          ? 'Prayer Request'
                          : selectedIntent === 'struggle'
                          ? 'Struggle'
                          : selectedIntent === 'testimony'
                          ? 'Testimony'
                          : 'Scripture Reflection'
                      }`}
                </p>
              </div>
              <button onClick={() => setIsComposeOpen(false)} className="text-[#707070] hover:text-[#0E0E0E] p-1">
                <X size={20} />
              </button>
            </div>

            {composeStep === 'intent' ? (
              <div className="space-y-2.5 pt-1">
                {/* 1. Request Prayer */}
                <div
                  onClick={() => {
                    setSelectedIntent('prayer')
                    setComposeStep('draft')
                  }}
                  className="faith-card p-3.5 flex items-center justify-between cursor-pointer hover:border-[#234537] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#EBF3EE] border border-[#234537]/30 text-[#234537] flex items-center justify-center font-bold shrink-0">
                      <HandsPraying size={20} weight="fill" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0E0E0E] group-hover:text-[#234537] transition-colors">
                        Request Prayer
                      </p>
                      <p className="text-[10px] text-[#707070]">
                        Invite the community to pray with you.
                      </p>
                    </div>
                  </div>
                  <CaretRight size={16} className="text-[#707070] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>

                {/* 2. Share a Struggle */}
                <div
                  onClick={() => {
                    setSelectedIntent('struggle')
                    setComposeStep('draft')
                  }}
                  className="faith-card p-3.5 flex items-center justify-between cursor-pointer hover:border-[#262626] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#F3F4F6] text-[#262626] flex items-center justify-center font-bold shrink-0">
                      <ShieldWarning size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0E0E0E] group-hover:text-[#262626] transition-colors">
                        Share a Struggle
                      </p>
                      <p className="text-[10px] text-[#707070]">
                        Honest declaration of difficulty and spiritual battles.
                      </p>
                    </div>
                  </div>
                  <CaretRight size={16} className="text-[#707070] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>

                {/* 3. Share a Testimony */}
                <div
                  onClick={() => {
                    setSelectedIntent('testimony')
                    setComposeStep('draft')
                  }}
                  className="faith-card p-3.5 flex items-center justify-between cursor-pointer hover:border-[#FBBF24] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#FDF9F1] border border-[#FBBF24]/40 text-[#FBBF24] flex items-center justify-center font-bold shrink-0">
                      <Sparkle size={20} weight="fill" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0E0E0E] group-hover:text-[#FBBF24] transition-colors">
                        Share a Testimony
                      </p>
                      <p className="text-[10px] text-[#707070]">
                        Celebrate God&apos;s faithfulness and answered prayers.
                      </p>
                    </div>
                  </div>
                  <CaretRight size={16} className="text-[#707070] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>

                {/* 4. Devotion & Scripture Reflection */}
                <div
                  onClick={() => {
                    setSelectedIntent('record')
                    setComposeStep('draft')
                  }}
                  className="faith-card p-3.5 flex items-center justify-between cursor-pointer hover:border-[#234537] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#EBF3EE] border border-[#234537]/30 text-[#234537] flex items-center justify-center font-bold shrink-0">
                      <BookOpen size={20} weight="bold" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0E0E0E] group-hover:text-[#234537] transition-colors">
                        Scripture & Devotion Reflection
                      </p>
                      <p className="text-[10px] text-[#707070]">
                        Share an edifying verse reflection or study note.
                      </p>
                    </div>
                  </div>
                  <CaretRight size={16} className="text-[#707070] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitPost} className="space-y-3.5 pt-1">
                {postError && (
                  <div className="p-3 rounded-xl bg-[#EBF3EE] border border-[#234537]/20 text-[#234537] text-xs font-semibold flex items-center gap-2">
                    <WarningCircle size={16} className="shrink-0" />
                    <span>{postError}</span>
                  </div>
                )}

                {/* 4-Category Pill Switcher */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#707070] block">Category</label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-white border border-[#E5E7EB] rounded-2xl">
                    {[
                      { id: 'prayer', label: 'Prayer' },
                      { id: 'struggle', label: 'Struggle' },
                      { id: 'testimony', label: 'Testimony' },
                      { id: 'record', label: 'Reflection' },
                    ].map((cat) => {
                      const isSel = selectedIntent === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedIntent(cat.id as IntentType)}
                          className={`py-1.5 px-1 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all text-center ${
                            isSel
                              ? 'bg-[#0E0E0E] text-white shadow-xs'
                              : 'text-[#707070] hover:text-[#0E0E0E] hover:bg-[#FAF6EE]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#707070] block mb-1">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="e.g. Medical exam tomorrow"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] shadow-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-[#707070]">
                      {selectedIntent === 'prayer'
                        ? 'Prayer Request'
                        : selectedIntent === 'struggle'
                        ? 'Struggle Details'
                        : 'Testimony Story'}
                    </label>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        charsRemaining < 15 ? 'text-[#234537] font-black' : 'text-[#707070]'
                      }`}
                    >
                      {postContent.length}/{charLimit}
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    maxLength={charLimit}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder={
                      selectedIntent === 'prayer'
                        ? 'What do you want the community to pray with you about?'
                        : selectedIntent === 'struggle'
                        ? 'What difficulty or challenge are you bringing before God and the church?'
                        : 'How has God moved in your life and answered prayer?'
                    }
                    className="w-full p-3.5 bg-white border border-[#E5E7EB] rounded-2xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] transition-all resize-none shadow-sm font-normal"
                  />
                </div>

                {/* Scripture Attachment in Compose Form */}
                <div className="space-y-2 pt-1">
                  {attachedScripture ? (
                    <div className="relative">
                      <ScriptureText
                        reference={attachedScripture.reference}
                        versionId={attachedScripture.versionId}
                        initialText={attachedScripture.text}
                        display="card"
                      />
                      <button
                        type="button"
                        onClick={() => setAttachedScripture(null)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-white/90 border border-[#E5E7EB] text-[#707070] hover:text-[#234537] transition-colors"
                        title="Remove scripture"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsScripturePickerOpen(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#FBBF24] text-[#0E0E0E] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <BookOpen size={15} className="text-[#FBBF24]" weight="fill" />
                      <span>+ Attach Scripture Verse</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs">
                  <div>
                    <span className="text-xs font-bold text-[#0E0E0E] block">Post Anonymously</span>
                    <span className="text-[10px] text-[#707070]">Hides your name, avatar, and church</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAnonymous}
                    onClick={() => setIsAnonymous(!isAnonymous)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                      isAnonymous ? 'bg-[#0E0E0E]' : 'bg-[#E5E7EB]'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        isAnonymous ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setComposeStep('intent')}
                    className="py-3 px-4 rounded-xl bg-white border border-[#E5E7EB] text-xs font-bold text-[#707070]"
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={!postContent.trim() || submittingPost}
                    className="flex-1 py-3 px-4 rounded-xl text-white font-bold text-xs bg-[#234537] hover:bg-[#183329] shadow-md shadow-[#234537]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {submittingPost ? (
                      <>
                        <CircleNotch size={16} className="animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <PaperPlaneTilt size={16} />
                        <span>Post to Square</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Scripture Picker Modal */}
      <ScripturePicker
        isOpen={isScripturePickerOpen}
        onClose={() => setIsScripturePickerOpen(false)}
        onSelect={(sel) => setAttachedScripture(sel)}
      />

      {/* Peer-to-Peer Connect Modal */}
      {connectModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-[#FAF6EE] border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-[#FBBF24]" />
                <h3 className="text-sm font-bold text-[#0E0E0E]">
                  Connect with {connectModalPost.authorName}
                </h3>
              </div>
              <button onClick={() => setConnectModalPost(null)} className="text-[#707070]">
                <X size={18} />
              </button>
            </div>

            {connectSent ? (
              <div className="py-6 text-center space-y-2 text-emerald-700">
                <Check size={28} className="mx-auto" weight="bold" />
                <p className="text-xs font-bold">Request & Intro Message Sent!</p>
              </div>
            ) : (
              <form onSubmit={handleSendConnectRequest} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#707070]">Write an Initial Message (140 chars):</span>
                  <span className="text-[10px] font-mono text-[#707070]">
                    {140 - connectMessage.length} left
                  </span>
                </div>

                <textarea
                  rows={3}
                  required
                  maxLength={140}
                  value={connectMessage}
                  onChange={(e) => setConnectMessage(e.target.value)}
                  placeholder="I saw your prayer request about your family and wanted to reach out. Can we connect?"
                  className="w-full p-3 bg-white border border-[#E5E7EB] rounded-xl text-xs text-[#0E0E0E] focus:outline-none focus:border-[#FBBF24] resize-none shadow-sm"
                />

                <button
                  type="submit"
                  disabled={!connectMessage.trim() || sendingConnectRequest}
                  className="w-full bg-[#0E0E0E] text-white py-3 rounded-xl font-bold text-xs shadow-md hover:bg-[#262626] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {sendingConnectRequest ? (
                    <>
                      <CircleNotch size={16} className="animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <PaperPlaneTilt size={16} />
                      <span>Send Request</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SquarePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center">
          <CircleNotch size={32} className="animate-spin text-[#234537]" />
        </div>
      }
    >
      <SquarePageContent />
    </React.Suspense>
  )
}
