'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Envelope,
  Lock,
  CircleNotch,
  WarningCircle,
  CheckCircle,
  ArrowLeft,
  ArrowClockwise,
  PencilSimple,
  ShieldCheck,
  Key,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthInput } from '@/components/auth/AuthInput'
import { getAuthErrorMessage } from '@/lib/authErrors'

type RecoveryStep = 'request' | 'verify_otp' | 'new_password'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<RecoveryStep>('request')

  // Step 1: Email
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 2: 6-digit OTP code
  const [otpCode, setOtpCode] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)

  // Step 3: New Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const isPasswordValid = newPassword.length >= 6
  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: REQUEST RECOVERY EMAIL / CODE
  // ═══════════════════════════════════════════════════════════════════════════
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)
    setError(null)
    setResendStatus(null)

    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const cleanEmail = email.trim().toLowerCase()

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      })

      if (resetErr) throw resetErr

      setStep('verify_otp')
    } catch (err: any) {
      setError(getAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: VERIFY 6-DIGIT IN-APP OTP CODE
  // ═══════════════════════════════════════════════════════════════════════════
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanCode = otpCode.trim().replace(/\D/g, '')
    if (cleanCode.length < 6) {
      setError('Please enter the full 6-digit code.')
      return
    }

    setVerifyingOtp(true)
    setError(null)
    setResendStatus(null)

    try {
      const supabase = createClient()
      const cleanEmail = email.trim().toLowerCase()

      // Attempt recovery verification first
      let verifyResult = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'recovery',
      })

      // Fallback to email verification type if needed
      if (verifyResult.error) {
        verifyResult = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'email',
        })
      }

      if (verifyResult.error) {
        throw verifyResult.error
      }

      // Code verified successfully! Transition to New Password form
      setStep('new_password')
    } catch (err: any) {
      setError(getAuthErrorMessage(err) || 'Invalid code. Please check and try again.')
    } finally {
      setVerifyingOtp(false)
    }
  }

  // Resend code
  const handleResendCode = async () => {
    if (!email) return
    setResending(true)
    setError(null)
    setResendStatus(null)
    try {
      const supabase = createClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const cleanEmail = email.trim().toLowerCase()

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      })

      if (resetErr) throw resetErr
      setResendStatus('A fresh reset code and link have been sent!')
    } catch (err: any) {
      setError(getAuthErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: SUBMIT NEW PASSWORD & SIGN IN
  // ═══════════════════════════════════════════════════════════════════════════
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setUpdatingPassword(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateErr) throw updateErr

      setPasswordSuccess(true)

      // Ensure session cookie is refreshed and navigate directly to /home
      setTimeout(() => {
        window.location.replace('/home')
      }, 1200)
    } catch (err: any) {
      setError(getAuthErrorMessage(err))
      setUpdatingPassword(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: STEP 3 (SET NEW PASSWORD)
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'new_password') {
    if (passwordSuccess) {
      return (
        <AuthCard subtitle="Password Reset" closeHref="/login">
          <div className="text-center py-6 space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle size={32} weight="fill" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-text-primary">Password Updated!</h3>
              <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
                Your password has been successfully updated. Signing you in...
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <CircleNotch size={24} className="animate-spin text-[#FBBF24]" />
            </div>
          </div>
        </AuthCard>
      )
    }

    return (
      <AuthCard subtitle="Set New Password" closeHref="/login">
        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-red-950/30 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <WarningCircle size={16} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-[#FBBF24] flex items-center justify-center mb-2">
            <Key size={20} weight="fill" />
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Create a secure new password with at least 6 characters.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-3.5">
          <div className="space-y-1">
            <AuthInput
              label="New Password"
              type="password"
              name="new-password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              icon={<Lock size={16} />}
              autoComplete="new-password"
              autoFocus
              required
            />
            {newPassword.length > 0 && (
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

          <div className="space-y-1">
            <AuthInput
              label="Confirm New Password"
              type="password"
              name="confirm-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock size={16} />}
              autoComplete="new-password"
              required
            />
            {confirmPassword.length > 0 && (
              <p
                className={`text-[10px] font-bold px-1 ${
                  doPasswordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {doPasswordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={updatingPassword || !isPasswordValid || !doPasswordsMatch}
            className="w-full py-4 px-6 rounded-2xl bg-[#FBBF24] text-text-primary font-black text-sm shadow-[0_4px_20px_rgba(251,191,36,0.25)] hover:bg-[#f5b318] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
          >
            {updatingPassword ? (
              <>
                <CircleNotch size={18} className="animate-spin text-text-primary" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Save & Sign In →</span>
            )}
          </button>
        </form>
      </AuthCard>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: STEP 2 (IN-APP 6-DIGIT OTP ENTRY)
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'verify_otp') {
    return (
      <AuthCard subtitle="Enter Reset Code" closeHref="/login">
        <div className="py-1 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/30 text-[#FBBF24] border border-amber-200/50 flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck size={30} weight="fill" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-text-primary">Check Your Email</h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
              We sent a 6-digit password reset code to{' '}
              <span className="font-bold text-text-primary">{email}</span>. Enter it below:
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-red-950/30 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in text-left">
              <WarningCircle size={16} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

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
                className="w-full text-center tracking-[0.35em] font-mono font-medium text-xl py-3 px-4 rounded-2xl bg-surface/70 dark:bg-neutral-900/70 border border-border/80 dark:border-white/15 focus:border-border focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 outline-none text-text-primary transition-all"
              />
            </div>

            {resendStatus && (
              <p className="text-[11px] font-bold p-2.5 rounded-xl border text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
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
                <span>Verify Code & Continue →</span>
              )}
            </button>
          </form>

          {/* Actions: Resend Code, Change Email, or Click Link Note */}
          <div className="pt-2 border-t border-border/70 space-y-2.5 text-left">
            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending}
                className="font-bold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ArrowClockwise size={13} className={resending ? 'animate-spin' : ''} />
                <span>{resending ? 'Sending...' : 'Resend code'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('request')
                  setOtpCode('')
                  setError(null)
                  setResendStatus(null)
                }}
                className="font-bold text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors cursor-pointer"
              >
                <PencilSimple size={13} />
                <span>Change email</span>
              </button>
            </div>

            <p className="text-[11px] text-text-muted text-center">
              Prefer the link? You can also click the reset link in your email.
            </p>

            <div className="text-center pt-1">
              <Link
                href="/login"
                className="inline-block text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </AuthCard>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: STEP 1 (REQUEST EMAIL)
  // ═══════════════════════════════════════════════════════════════════════════
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
        Enter your account email address. We&apos;ll send you a 6-digit code and a secure link to reset your password.
      </p>

      <form onSubmit={handleRequestReset} className="space-y-4">
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
              <span>Sending Reset Code...</span>
            </>
          ) : (
            <span>Send Reset Code</span>
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
