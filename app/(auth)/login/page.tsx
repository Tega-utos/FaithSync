'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Envelope, Lock, CircleNotch, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { getAuthErrorMessage } from '@/lib/authErrors'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  // Capture errors or status passed via URL (e.g. from callback or password reset)
  useEffect(() => {
    const urlError = searchParams.get('error')
    const urlMessage = searchParams.get('message')
    if (urlError) {
      setError(decodeURIComponent(urlError))
    }
    if (urlMessage) {
      setInfoMessage(decodeURIComponent(urlMessage))
    }
  }, [searchParams])

  // Email & Password Sign In
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please provide both email and password.')
      return
    }

    setLoading(true)
    setError(null)
    setInfoMessage(null)

    try {
      const supabase = createClient()
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInErr) throw signInErr

      if (data.session) {
        // Check if user has completed onboarding preferences
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, preferences')
          .eq('id', data.session.user.id)
          .maybeSingle()

        if (!profile || !profile.preferences) {
          router.replace('/onboarding')
        } else {
          router.replace('/home')
        }
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err))
      setLoading(false)
    }
  }

  // Google OAuth Sign In (instant account selection without forced consent roadblocks)
  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError(null)
    setInfoMessage(null)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { data, error: gError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=/home`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      if (gError) throw gError
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err))
      setGoogleLoading(false)
    }
  }

  return (
    <AuthCard subtitle="Sync Up!" closeHref="/welcome">
      {/* Informational Notification */}
      {infoMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle size={16} className="shrink-0 text-emerald-600" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-red-950/30 border border-rose-200 text-rose-700 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <WarningCircle size={16} className="shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Email Sign In Form */}
      <form onSubmit={handleEmailLogin} className="space-y-3">
        <AuthInput
          label="Your email"
          type="email"
          name="email"
          placeholder="name@faithsync.app"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Envelope size={16} />}
          autoComplete="email"
          required
        />

        <div className="space-y-1">
          <AuthInput
            label="Your password"
            type="password"
            name="password"
            placeholder="Your account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={16} />}
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end pt-0.5">
            <Link
              href="/forgot-password"
              className="text-[11px] font-bold text-text-secondary hover:text-text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-1"
        >
          {loading ? (
            <>
              <CircleNotch size={18} className="animate-spin text-text-primary" />
              <span>Signing In...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      {/* Dashed Divider */}
      <div className="relative flex items-center justify-center my-1">
        <div className="border-t-2 border-dashed border-border w-full" />
        <span className="bg-surface px-3 text-[11px] font-bold text-text-secondary uppercase tracking-wider shrink-0">
          or continue with
        </span>
      </div>

      {/* 2. Continue with Google */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        className="w-full py-3.5 px-4 rounded-2xl bg-card border border-border hover:bg-subtle active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-2xs font-bold text-xs text-text-primary cursor-pointer disabled:opacity-60"
      >
        {googleLoading ? (
          <CircleNotch size={18} className="animate-spin text-[#FBBF24]" />
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{googleLoading ? 'Connecting...' : 'Sign in with Google'}</span>
      </button>

      {/* Switch to Register */}
      <div className="text-center pt-1 pb-1">
        <p className="text-xs text-text-secondary font-medium">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-bold text-text-primary hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <CircleNotch size={28} className="animate-spin text-[#FBBF24]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
