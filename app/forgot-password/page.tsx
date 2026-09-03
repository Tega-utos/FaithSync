'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Envelope, CircleNotch, WarningCircle, CheckCircle, ArrowLeft } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { getAuthErrorMessage } from '@/lib/authErrors'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''

      // Route via PKCE auth callback to securely exchange code for a recovery session
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      })

      if (resetErr) throw resetErr

      setSubmitted(true)
    } catch (err: any) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <AuthCard subtitle="Check Your Email" closeHref="/login">
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle size={32} weight="fill" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-text-primary">Password Reset Link Sent</h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
              If an account exists for <span className="font-bold text-text-primary">{email}</span>, you will receive an email with instructions to securely reset your password.
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="w-full py-3.5 px-6 rounded-2xl bg-card border border-border hover:bg-[#FDF9F1] dark:bg-amber-950/30 font-bold text-xs text-text-primary shadow-2xs transition-all cursor-pointer"
            >
              Try another email
            </button>
            <Link
              href="/login"
              className="inline-block w-full py-3 px-6 text-center text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard subtitle="Reset Password" closeHref="/login">
      {/* Error Alert */}
      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-red-950/30 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <WarningCircle size={16} className="shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-text-secondary leading-relaxed">
        Enter the email address associated with your account and we will send you a secure link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <CircleNotch size={18} className="animate-spin text-text-primary" />
              <span>Sending Link...</span>
            </>
          ) : (
            <span>Send Reset Link</span>
          )}
        </button>
      </form>

      <div className="text-center pt-1 pb-1">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </AuthCard>
  )
}
