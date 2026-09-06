'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  PaperPlaneTilt,
  CircleNotch,
  User,
  Trash,
  Eye,
  EyeSlash,
  ChatCircle,
  Clock,
  ArrowUp,
  HandsPraying,
  ShieldWarning,
  Sparkle,
  BookOpen,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/admin/adminAuth'
import { SquarePostItem } from '@/features/square/hooks/useSquarePosts'

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

interface SquareCommentDrawerProps {
  post: SquarePostItem | null
  isOpen: boolean
  onClose: () => void
  currentUser: any
  userProfile: any
  onCommentCountChange?: (postId: string, newCount: number) => void
}

const PAGE_SIZE = 20

export function SquareCommentDrawer({
  post,
  isOpen,
  onClose,
  currentUser,
  userProfile,
  onCommentCountChange,
}: SquareCommentDrawerProps) {
  const [comments, setComments] = useState<SquareCommentItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [hasEarlierComments, setHasEarlierComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  const commentsEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior })
    }, 60)
  }

  // Load initial comments when drawer opens
  useEffect(() => {
    if (!isOpen || !post) {
      setComments([])
      setTotalCount(0)
      return
    }

    let isMounted = true

    async function loadComments() {
      if (!post) return
      setLoading(true)
      try {
        const supabase = createClient()

        // 1. Get total comment count
        const { count } = await (supabase
          .from('square_comments') as any)
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id)

        const total = count || 0
        if (isMounted) setTotalCount(total)

        // 2. Fetch latest 20 comments in ascending order
        // To get the latest 20 in chronological order, fetch descending then reverse
        const { data: rawComments, error } = await (supabase
          .from('square_comments') as any)
          .select(`
            *,
            profiles:user_id (
              id,
              display_name,
              full_name,
              username,
              avatar_url,
              church,
              email
            )
          `)
          .eq('post_id', post.id)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE)

        if (!error && rawComments && isMounted) {
          const formatted: SquareCommentItem[] = rawComments.reverse().map((c: any) => {
            const isAnon = Boolean(c.is_anonymous)
            const p = c.profiles || {}
            const isSelf = Boolean(currentUser && c.user_id === currentUser.id)
            
            let rawName =
              p.display_name ||
              p.full_name ||
              p.username ||
              (isSelf ? (userProfile?.display_name || userProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name) : null)

            if (!rawName && p.email && p.email.includes('@')) {
              const handle = p.email.split('@')[0].replace(/[._-]+/g, ' ').trim()
              if (handle) {
                rawName = handle.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
              }
            }

            return {
              id: c.id,
              post_id: c.post_id,
              user_id: isAnon ? '' : c.user_id,
              content: c.content,
              is_anonymous: isAnon,
              authorName: isAnon ? 'Anonymous Member' : (rawName || 'Believer'),
              authorAvatar: isAnon ? null : (p.avatar_url || (isSelf ? (userProfile?.avatar_url || currentUser?.user_metadata?.avatar_url) : null) || null),
              authorChurch: isAnon ? 'Community Square' : (p.church || (isSelf ? userProfile?.church : null) || 'Local Assembly'),
              created_at: c.created_at,
            }
          })

          setComments(formatted)
          setHasEarlierComments(total > formatted.length)
          scrollToBottom('auto')
        }
      } catch (err) {
        console.error('Failed to load comments in drawer:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadComments()

    return () => {
      isMounted = false
    }
  }, [isOpen, post?.id])

  // Load earlier comments when user taps "Load earlier encouragements"
  const handleLoadEarlier = async () => {
    if (!post || comments.length === 0 || loadingEarlier) return

    setLoadingEarlier(true)
    try {
      const supabase = createClient()
      const oldestLoadedTimestamp = comments[0].created_at

      const { data: rawEarlier, error } = await (supabase
        .from('square_comments') as any)
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            full_name,
            username,
            avatar_url,
            church,
            email
          )
        `)
        .eq('post_id', post.id)
        .lt('created_at', oldestLoadedTimestamp)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (!error && rawEarlier && rawEarlier.length > 0) {
        const formatted: SquareCommentItem[] = rawEarlier.reverse().map((c: any) => {
          const isAnon = Boolean(c.is_anonymous)
          const p = c.profiles || {}
          const isSelf = Boolean(currentUser && c.user_id === currentUser.id)
          let rawName =
            p.display_name ||
            p.full_name ||
            p.username ||
            (isSelf ? (userProfile?.display_name || userProfile?.full_name || currentUser?.user_metadata?.full_name) : null)

          if (!rawName && p.email && p.email.includes('@')) {
            const handle = p.email.split('@')[0].replace(/[._-]+/g, ' ').trim()
            if (handle) {
              rawName = handle.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
            }
          }

          return {
            id: c.id,
            post_id: c.post_id,
            user_id: isAnon ? '' : c.user_id,
            content: c.content,
            is_anonymous: isAnon,
            authorName: isAnon ? 'Anonymous Member' : (rawName || 'Believer'),
            authorAvatar: isAnon ? null : (p.avatar_url || (isSelf ? userProfile?.avatar_url : null) || null),
            authorChurch: isAnon ? 'Community Square' : (p.church || 'Local Assembly'),
            created_at: c.created_at,
          }
        })

        const newCombined = [...formatted, ...comments]
        setComments(newCombined)
        setHasEarlierComments(totalCount > newCombined.length)
      } else {
        setHasEarlierComments(false)
      }
    } catch (err) {
      console.error('Failed to load earlier comments:', err)
    } finally {
      setLoadingEarlier(false)
    }
  }

  // Submit comment handler
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = commentText.trim()
    if (!text || !post || !currentUser || submitting) return

    setSubmitting(true)
    const tempId = `cmt-${Date.now()}`

    const myName =
      userProfile?.display_name ||
      userProfile?.full_name ||
      userProfile?.username ||
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.user_metadata?.display_name ||
      (currentUser.email ? currentUser.email.split('@')[0] : 'Believer')

    const optimisticComment: SquareCommentItem = {
      id: tempId,
      post_id: post.id,
      user_id: isAnonymous ? '' : currentUser.id,
      content: text,
      is_anonymous: isAnonymous,
      authorName: isAnonymous ? 'Anonymous Member' : myName,
      authorAvatar: isAnonymous ? null : (userProfile?.avatar_url || currentUser.user_metadata?.avatar_url || null),
      authorChurch: isAnonymous ? 'Community Square' : (userProfile?.church || currentUser.user_metadata?.church || 'Local Assembly'),
      created_at: new Date().toISOString(),
    }

    setComments((prev) => [...prev, optimisticComment])
    const newTotal = totalCount + 1
    setTotalCount(newTotal)
    if (onCommentCountChange) {
      onCommentCountChange(post.id, newTotal)
    }

    setCommentText('')
    scrollToBottom('smooth')

    try {
      const supabase = createClient()
      const { data: inserted, error } = await (supabase
        .from('square_comments') as any)
        .insert({
          post_id: post.id,
          user_id: currentUser.id,
          content: text,
          is_anonymous: isAnonymous,
        })
        .select('id')
        .maybeSingle()

      if (error) {
        throw error
      }

      if (inserted) {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: inserted.id } : c))
        )

        // Dispatch in-app notification and web push to post author (if not self-comment)
        if (post.user_id && post.user_id !== currentUser.id) {
          try {
            const snippet = text.length > 60 ? `${text.slice(0, 57)}...` : text
            const authorLabel = isAnonymous ? 'A believer' : myName
            fetch('/api/notifications/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetUserId: post.user_id,
                type: 'square_comment',
                title: 'Reflection Encouragement',
                message: `${authorLabel} encouraged your reflection: "${snippet}"`,
                url: '/square',
              }),
            }).catch(() => {})
          } catch (notifSendErr) {
            console.error('Comment notification dispatch note:', notifSendErr)
          }
        }
      }
    } catch (err) {
      console.error('Failed to save comment:', err)
      // Rollback optimistic comment on failure
      setComments((prev) => prev.filter((c) => c.id !== tempId))
      setTotalCount((prev) => Math.max(0, prev - 1))
      if (onCommentCountChange) {
        onCommentCountChange(post.id, totalCount)
      }
      alert('Could not submit comment. Please check your connection.')
    } finally {
      setSubmitting(false)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  // Delete comment handler
  const handleDeleteComment = async (commentId: string) => {
    if (deletingCommentId) return
    setDeletingCommentId(commentId)

    const previousComments = [...comments]
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    const newTotal = Math.max(0, totalCount - 1)
    setTotalCount(newTotal)
    if (post && onCommentCountChange) {
      onCommentCountChange(post.id, newTotal)
    }

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/square/delete-comment', {
        method: 'POST',
        headers,
        body: JSON.stringify({ commentId }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to delete comment')
      }
    } catch (err: any) {
      console.error('Delete comment error:', err)
      setComments(previousComments)
      setTotalCount(totalCount)
      if (post && onCommentCountChange) {
        onCommentCountChange(post.id, totalCount)
      }
      alert(err?.message || 'Could not delete comment.')
    } finally {
      setDeletingCommentId(null)
    }
  }

  if (!isOpen || !post) return null

  const isPrayer = post.post_type === 'prayer' || post.post_type === 'prayer_request'
  const isStruggle = post.post_type === 'struggle'
  const isTestimony = post.post_type === 'testimony'
  const isRecord =
    post.post_type === 'record' ||
    post.content.startsWith('Completed') ||
    post.content.includes('Daily Devotion')
  const isReflection = !isRecord && (post.post_type === 'reflection' || (!isPrayer && !isStruggle && !isTestimony))

  const postTimeFormatted = new Date(post.created_at).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  }) + ' • ' + new Date(post.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer Card */}
      <div className="relative w-full max-w-lg h-[85vh] sm:h-[680px] bg-card border border-border sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Drawer Header */}
        <div className="p-3.5 sm:p-4 border-b border-border/80 bg-surface/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-xs flex items-center justify-center border border-white/20 shadow-xs shrink-0 overflow-hidden">
              {post.is_anonymous ? (
                <User size={15} weight="bold" />
              ) : post.authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.authorAvatar}
                  alt={post.authorName || 'Believer'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{(post.authorName || 'B').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-text-primary truncate">
                  Responding to {post.is_anonymous ? 'Anonymous Member' : post.authorName || 'Believer'}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-card border border-border text-text-secondary shrink-0">
                  {totalCount} {totalCount === 1 ? 'Comment' : 'Comments'}
                </span>
              </div>
              <p className="text-[11px] text-text-secondary truncate">
                Community Square Fellowship
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-card border border-border hover:bg-card-hover text-text-secondary hover:text-text-primary flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
            title="Close comments"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Scrollable Conversation List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 overscroll-contain"
        >
          {/* Full Original Post Preview Card */}
          <div className="p-4 rounded-2xl bg-surface/90 dark:bg-neutral-900/90 border border-border/90 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] font-bold text-xs flex items-center justify-center border border-white/20 shadow-xs shrink-0 overflow-hidden">
                  {post.is_anonymous ? (
                    <User size={15} weight="bold" />
                  ) : post.authorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.authorAvatar}
                      alt={post.authorName || 'Believer'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{(post.authorName || 'B').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-text-primary truncate">
                    {post.is_anonymous ? 'Anonymous Member' : post.authorName || 'Believer'}
                  </p>
                  <p className="text-[10px] text-text-secondary truncate">
                    {post.is_anonymous ? 'Community Square' : post.authorChurch || 'Local Assembly'} • {postTimeFormatted}
                  </p>
                </div>
              </div>

              {/* Category Badge */}
              <div className="shrink-0">
                {isPrayer ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EBF3EE] dark:bg-emerald-950/30 border border-[#234537]/25 dark:border-emerald-700/30 text-[#234537] dark:text-emerald-400 text-[10px] font-bold inline-flex items-center gap-1">
                    <HandsPraying size={11} weight="fill" />
                    <span>Prayer</span>
                  </span>
                ) : isStruggle ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-subtle text-[#262626] dark:text-neutral-300 text-[10px] font-bold inline-flex items-center gap-1">
                    <ShieldWarning size={11} />
                    <span>Struggle</span>
                  </span>
                ) : isTestimony ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FDF9F1] dark:bg-amber-950/30 border border-[#FBBF24]/35 text-[#FBBF24] text-[10px] font-bold inline-flex items-center gap-1">
                    <Sparkle size={11} weight="fill" />
                    <span>Testimony</span>
                  </span>
                ) : isReflection ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#EBF3EE] dark:bg-emerald-950/30 border border-[#234537]/25 dark:border-emerald-700/30 text-[#234537] dark:text-emerald-400 text-[10px] font-bold inline-flex items-center gap-1">
                    <BookOpen size={11} weight="bold" />
                    <span>Reflection</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-surface border border-border text-text-secondary text-[10px] font-bold inline-flex items-center gap-1">
                    <Clock size={11} />
                    <span>Record</span>
                  </span>
                )}
              </div>
            </div>

            {/* Full Post Text Content */}
            <div className="text-xs sm:text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap pl-0.5 font-normal">
              {post.content}
            </div>
          </div>

          {/* Section Transition Divider */}
          <div className="flex items-center gap-2 pt-1 pb-0.5">
            <div className="h-px bg-border/80 flex-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Encouragements ({totalCount})
            </span>
            <div className="h-px bg-border/80 flex-1" />
          </div>
          {/* Pagination: Load Earlier Encouragements */}
          {hasEarlierComments && (
            <div className="flex justify-center pb-1">
              <button
                type="button"
                disabled={loadingEarlier}
                onClick={handleLoadEarlier}
                className="px-3.5 py-1.5 rounded-full bg-card border border-border hover:border-[#FBBF24] text-[11px] font-bold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {loadingEarlier ? (
                  <>
                    <CircleNotch size={13} className="animate-spin text-[#FBBF24]" />
                    <span>Loading earlier discussions...</span>
                  </>
                ) : (
                  <>
                    <ArrowUp size={12} weight="bold" className="text-[#FBBF24]" />
                    <span>Load earlier encouragements ({totalCount - comments.length} remaining)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-xs text-text-secondary">
              <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
              <span>Loading fellowship comments...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="py-16 text-center space-y-2 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-surface border border-border text-text-secondary flex items-center justify-center">
                <ChatCircle size={24} />
              </div>
              <p className="text-xs font-bold text-text-primary">No comments yet</p>
              <p className="text-[11px] text-text-secondary max-w-xs">
                Be the first believer to share an encouraging scripture, prayer, or comforting word.
              </p>
            </div>
          ) : (
            comments.map((comment) => {
              const isSelf = Boolean(
                currentUser &&
                (comment.user_id === currentUser.id || (!comment.user_id && comment.authorName === (userProfile?.display_name || currentUser?.user_metadata?.full_name)))
              )
              const canDelete =
                currentUser &&
                (isSelf || isSuperAdmin(currentUser.email))

              const timeFormatted = new Date(comment.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={comment.id}
                  className="group p-3 rounded-2xl bg-card-hover border border-border/80 space-y-1.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] text-[10px] font-bold flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                        {comment.is_anonymous ? (
                          <User size={13} weight="bold" />
                        ) : comment.authorAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={comment.authorAvatar}
                            alt={comment.authorName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{(comment.authorName || 'B').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-text-primary">
                          {comment.authorName}
                        </span>
                        {!comment.is_anonymous && comment.authorChurch && (
                          <span className="text-[10px] text-text-secondary">
                            • {comment.authorChurch}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-text-secondary font-mono flex items-center gap-1">
                        <Clock size={10} />
                        <span>{timeFormatted}</span>
                      </span>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-text-secondary/60 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                          title="Delete comment"
                        >
                          <Trash size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clean comment text */}
                  <p className="text-xs text-text-primary pl-8 leading-relaxed whitespace-pre-line">
                    {comment.content}
                  </p>
                </div>
              )
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Sticky Bottom Compose Bar */}
        <div className="p-3 border-t border-border/80 bg-surface/95 backdrop-blur-md shrink-0 space-y-2">
          <form onSubmit={handleSendComment} className="flex items-end gap-2">
            {/* Anonymity Toggle */}
            <button
              type="button"
              onClick={() => setIsAnonymous((prev) => !prev)}
              className={`p-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
                isAnonymous
                  ? 'bg-[#EBF3EE] text-[#234537] dark:bg-emerald-950/40 dark:text-emerald-400 border-[#234537]/30 shadow-xs font-bold'
                  : 'bg-card text-text-secondary hover:text-text-primary border-border hover:border-[#FBBF24]'
              }`}
              title={isAnonymous ? 'Posting anonymously (Click to show name)' : 'Posting with name (Click for anonymous)'}
            >
              {isAnonymous ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} />}
            </button>

            {/* Auto-expanding Input */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendComment(e)
                }
              }}
              placeholder={isAnonymous ? 'Encourage as Anonymous Member...' : 'Write an encouraging comment or prayer...'}
              className="flex-1 px-3.5 py-2.5 rounded-2xl bg-card border border-border text-xs font-normal text-text-primary placeholder:text-text-secondary/70 focus:outline-none focus:border-[#FBBF24] focus:ring-1 focus:ring-[#FBBF24]/30 shadow-xs resize-none max-h-24 leading-relaxed"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!commentText.trim() || submitting}
              className="p-2.5 rounded-xl bg-[#0E0E0E] dark:bg-white/90 text-white dark:text-[#0E0E0E] disabled:opacity-40 hover:bg-[#262626] transition-all cursor-pointer active:scale-95 shadow-md shrink-0 flex items-center justify-center"
              title="Post comment"
            >
              {submitting ? (
                <CircleNotch size={16} className="animate-spin" />
              ) : (
                <PaperPlaneTilt size={16} weight="fill" />
              )}
            </button>
          </form>

          {isAnonymous && (
            <div className="flex items-center gap-1 text-[10px] text-[#234537] dark:text-emerald-400 pl-1">
              <EyeSlash size={12} weight="bold" />
              <span>Posting anonymously. Your identity is veiled in this comment.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
