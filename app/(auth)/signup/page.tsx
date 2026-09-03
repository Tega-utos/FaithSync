'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  User,
  Envelope,
  Lock,
  CircleNotch,
  WarningCircle,
  CheckCircle,
  ArrowClockwise,
  PencilSimple,
  ShieldCheck,
} from '@phosphor-icons/react'
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
  
  // In-app OTP verification states
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  const isPasswordValid = password.length >= 6

  // Email & Password Registration
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

      // Detect duplicate email if identities array is empty
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setErrorMessage('An account with this email is already registered. Please sign in instead.')
        setLoading(false)
        return
      }

      if (data.session) {
        // Immediate session created: proceed directly to onboarding
        router.replace('/onboarding')
        return
      }

      // Try automatic sign in (if auto-confirm is active in Supabase)
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

      // Confirmation email required: prompt user with in-app 6-digit OTP code entry
      setEmailConfirmationRequired(true)
    } catch (err: any) {
      setErrorMessage(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // Handle direct in-app 6-digit OTP code verification
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanCode = otpCode.trim().replace(/\D/g, '')
    if (cleanCode.length < 6) {
      setResendStatus('Please enter the full 6-digit code.')
      return
    }

    setVerifyingOtp(true)
    setResendStatus(null)

    try {
      const supabase = createClient()
      const trimmedEmail = email.trim().toLowerCase()

      // Attempt verification with signup type first, fallback to email type
      let verifyResult = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: cleanCode,
        type: 'signup',
      })

      if (verifyResult.error) {
        verifyResult = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: cleanCode,
          type: 'email',
        })
      }

      if (verifyResult.error) {
        throw verifyResult.error
      }

      if (verifyResult.data.session || verifyResult.data.user) {
        // Successful verification! Provision profile if needed and go straight to onboarding
        const user = verifyResult.data.session?.user || verifyResult.data.user
        if (user) {
          const generatedCode = user.id.replace(/-/g, '').slice(0, 6).toUpperCase()
          await supabase.from('profiles').upsert({
            id: user.id,
            display_name: fullName.trim() || user.user_metadata?.full_name || 'Believer',
            buddy_code: generatedCode,
            church: 'Local Assembly',
          }, { onConflict: 'id' })
        }

        router.replace('/onboarding')
        return
      }
    } catch (err: any) {
      setResendStatus(getAuthErrorMessage(err) || 'Invalid code. Please check and try again.')
    } finally {
      setVerifyingOtp(false)
    }
  }

  // Resend confirmation email / code
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
      setResendStatus('A fresh verification code and link were sent! Check your inbox & spam.')
    } catch (err: any) {
      setResendStatus(getAuthErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  // Google OAuth Sign Up (seamless without repetitive forced consent screens)
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
            prompt: 'select_account',
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

  // ═══════════════════════════════════════════════════════════════════════════
  // IN-APP EMAIL / OTP VERIFICATION SCREEN (NO NAVIGATING AWAY REQUIRED)
  // ═══════════════════════════════════════════════════════════════════════════
  if (emailConfirmationRequired) {
    return (
      <AuthCard subtitle="Confirm Your Email" closeHref="/welcome">
        <div className="py-2 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck size={30} weight="fill" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-text-primary">Enter Confirmation Code</h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
              We sent a 6-digit code to{' '}
              <span className="font-bold text-text-primary">{email}</span>. Enter it below to activate your account instantly:
            </p>
          </div>

          {/* 6-Digit In-App Code Input Form */}
          <form onSubmit={handleVerifyOtp} className="space-y-3 pt-1">
            <div className="max-w-[240px] mx-auto">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                autoFocus
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full text-center tracking-[0.4em] font-mono font-black text-2xl py-3 px-4 rounded-2xl bg-card border-2 border-border focus:border-[#FBBF24] focus:ring-4 focus:ring-[#FBBF24]/20 outline-none text-text-primary transition-all shadow-inner"
              />
            </div>

            {resendStatus && (
              <p
                className={`text-[11px] font-bold p-2.5 rounded-xl border ${
                  resendStatus.includes('fresh') || resendStatus.includes('sent')
                    ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200'
                    : 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 border-amber-200'
                }`}
              >
                {resendStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={verifyingOtp || otpCode.trim().length < 6}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {verifyingOtp ? (
                <>
                  <CircleNotch size={16} className="animate-spin text-text-primary" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify & Continue →</span>
              )}
            </button>
          </form>

          {/* Helpful Options: Resend, Edit Email, or Click Link */}
          <div className="pt-2 border-t border-border/70 space-y-2.5">
            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resending}
                className="font-bold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowClockwise size={13} className={resending ? 'animate-spin' : ''} />
                <span>{resending ? 'Sending...' : 'Resend code'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmailConfirmationRequired(false)
                  setOtpCode('')
                  setResendStatus(null)
                }}
                className="font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors cursor-pointer"
              >
                <PencilSimple size={13} />
                <span>Change email</span>
              </button>
            </div>

            <p className="text-[11px] text-text-muted">
              Prefer the link? You can also click the confirmation link in your email.
            </p>

            <Link
              href="/login"
              className="inline-block text-xs font-bold text-text-secondary hover:text-text-primary transition-colors pt-1"
            >
              Already activated? Sign in
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STANDARD SIGN UP FORM
  // ═══════════════════════════════════════════════════════════════════════════
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
                <Link href="/login" className="underline font-black text-rose-800 dark:text-rose-400">
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
                  isPasswordValid ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              <span
                className={`text-[10px] font-bold ${
                  isPasswordValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
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
