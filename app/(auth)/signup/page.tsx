'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Envelope, Lock, CircleNotch, WarningCircle, CheckCircle, ArrowClockwise } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { getAuthErrorMessage } from '@/lib/authErrors'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  const isPasswordValid = password.length >= 6

  // Email & Password Registration with strict duplicate email enforcement
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in all fields.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const trimmedEmail = email.trim().toLowerCase()

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
        },
      })

      if (error) throw error

      // CRITICAL: Supabase returns data.user with an EMPTY identities array [] when the email already exists in the database.
      // We lock this in and block duplicate account creation attempts.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrorMessage('An account with this email is already registered and locked in. Please sign in instead.')
        setLoading(false)
        return
      }

      if (data.session) {
        // Immediate session created: proceed directly to onboarding
        router.replace('/onboarding')
        return
      }

      // Try automatic sign in (if auto-confirm is active on this project)
      try {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        })
        if (signInData?.session) {
          router.replace('/onboarding')
          return
        }
      } catch {}

      // Confirmation email required for first-time newly registered user
      setEmailConfirmationRequired(true)
    } catch (err: any) {
      setErrorMessage(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // Resend confirmation email
  const handleResendEmail = async () => {
    if (!email) return
    setResending(true)
    setResendStatus(null)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
        },
      })
      if (error) throw error
      setResendStatus('Verification link resent! Please check your inbox & spam folder.')
    } catch (err: any) {
      setResendStatus(getAuthErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  // Google OAuth Sign Up (with PKCE callback routing to /onboarding)
  const handleGoogleSignUp = async () => {
    setGoogleLoading(true)
    setErrorMessage(null)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { data, error: gError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=/onboarding`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (gError) throw gError
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      setErrorMessage(getAuthErrorMessage(err))
      setGoogleLoading(false)
    }
  }

  if (emailConfirmationRequired) {
    return (
      <AuthCard subtitle="Verify Your Email" closeHref="/welcome">
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle size={32} weight="fill" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-text-primary">Verification Link Sent</h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
              We sent a confirmation link to <span className="font-bold text-text-primary">{email}</span>. Click the link in your email to activate your account and complete setup.
            </p>
          </div>

          {resendStatus && (
            <p className="text-[11px] font-bold text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              {resendStatus}
            </p>
          )}

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resending}
              className="w-full py-3.5 px-6 rounded-2xl bg-card border border-border hover:bg-[#FDF9F1] dark:bg-amber-950/30 text-text-primary font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {resending ? (
                <>
                  <CircleNotch size={14} className="animate-spin text-text-primary" />
                  <span>Resending...</span>
                </>
              ) : (
                <>
                  <ArrowClockwise size={14} />
                  <span>Resend Confirmation Email</span>
                </>
              )}
            </button>

            <Link
              href="/login"
              className="inline-block w-full py-3 px-6 text-center text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
            >
              Already confirmed? Sign in
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard subtitle="Create Account" closeHref="/welcome">
      {/* Error Feedback */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-red-950/30 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <WarningCircle size={18} className="shrink-0 text-rose-500" />
          <div className="flex-1">
            <span>{errorMessage}</span>
            {errorMessage.includes('already registered') && (
              <div className="pt-1">
                <Link href="/login" className="underline font-black text-rose-800">
                  Click here to Sign In →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Email Sign Up Form */}
      <form onSubmit={handleEmailSignUp} className="space-y-3">
        <AuthInput
          label="Full Name"
          type="text"
          name="name"
          placeholder="First and last name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          icon={<User size={16} />}
          autoComplete="name"
          required
        />

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
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock size={16} />}
            autoComplete="new-password"
            required
          />
          {password.length > 0 && (
            <div className="flex items-center gap-1.5 px-1 pt-0.5">
              <div
                className={`h-1 flex-1 rounded-full transition-all ${
                  isPasswordValid ? 'bg-emerald-50 dark:bg-emerald-950/300' : 'bg-amber-400'
                }`}
              />
              <span
                className={`text-[10px] font-bold ${
                  isPasswordValid ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {isPasswordValid ? 'Password meets requirements' : 'Must be at least 6 characters'}
              </span>
            </div>
          )}
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
              <span>Creating Account...</span>
            </>
          ) : (
            <span>Create Account</span>
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

      {/* 2. Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={googleLoading || loading}
        className="w-full py-3.5 px-4 rounded-2xl bg-card border border-border hover:bg-[#FDF9F1] dark:bg-amber-950/30 active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-2xs font-bold text-xs text-text-primary cursor-pointer disabled:opacity-60"
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
        <span>{googleLoading ? 'Connecting...' : 'Sign up with Google'}</span>
      </button>

      {/* Switch to Login */}
      <div className="text-center pt-1 pb-1">
        <p className="text-xs text-text-secondary font-medium">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-bold text-text-primary hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}
